import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileProviderCallbackTransaction } from '../src/core/provider-delivery-callback.js';

function makeDb({matched=true}={}) {
  const queries=[];
  const db={transaction:async(fn)=>fn({async query(sql, params=[]){
    queries.push({sql,params});
    if(/FROM message_outbox/.test(sql)) {
      return matched
        ? {rows:[{outbox_id:'O1',conversation_id:'C1',provider:'wa',outbound_provider_message_id:'WA-OUT-1',inbound_id:'I1',inbound_provider_message_id:'WA-IN-1'}]}
        : {rows:[]};
    }
    if(/UPDATE message_outbox/.test(sql)) {
      return {rows:[{id:'O1',delivery_state:params[3],provider_message_id:'WA-OUT-1'}]};
    }
    if(/INSERT INTO audit_events/.test(sql)) return {rows:[{id:'A1'}]};
    throw new Error('UNEXPECTED_SQL');
  }})};
  return {db,queries};
}

test('provider callback composes parse, identity, canonical outbox mutation and audit', async () => {
  const {db,queries}=makeDb();
  const result=await reconcileProviderCallbackTransaction(db,{provider:'wa',parseDeliveryStatus:async()=>({status:'DELIVERED',provider_message_id:'WA-OUT-1'}),request:{}});
  assert.equal(result.status,'RECONCILED');
  assert.equal(result.result.normalized.provider_status,'DELIVERED');
  assert.equal(result.result.normalized.delivery_state,'SENT');
  assert.equal(queries.filter((q)=>/UPDATE message_outbox/.test(q.sql)).length,1);
  assert.equal(queries.filter((q)=>/INSERT INTO audit_events/.test(q.sql)).length,1);
});

test('provider callback preserves ACCEPTED as PROCESSING instead of forcing SENT', async () => {
  const {db,queries}=makeDb();
  const result=await reconcileProviderCallbackTransaction(db,{provider:'wa',parseDeliveryStatus:async()=>({status:'ACCEPTED',provider_message_id:'WA-OUT-1'}),request:{}});
  assert.equal(result.status,'RECONCILED');
  assert.equal(result.result.normalized.delivery_state,'PROCESSING');
  const update=queries.find((q)=>/UPDATE message_outbox/.test(q.sql));
  assert.equal(update.params[3],'PROCESSING');
});

test('provider callback maps FAILED to FAILED', async () => {
  const {db,queries}=makeDb();
  const result=await reconcileProviderCallbackTransaction(db,{provider:'wa',parseDeliveryStatus:async()=>({status:'FAILED',provider_message_id:'WA-OUT-1'}),request:{}});
  assert.equal(result.status,'RECONCILED');
  assert.equal(result.result.normalized.delivery_state,'FAILED');
  const update=queries.find((q)=>/UPDATE message_outbox/.test(q.sql));
  assert.equal(update.params[3],'FAILED');
});

test('unknown provider callback cannot reach mutation or audit', async () => {
  const {db,queries}=makeDb({matched:false});
  const result=await reconcileProviderCallbackTransaction(db,{provider:'wa',parseDeliveryStatus:async()=>({status:'DELIVERED',provider_message_id:'UNKNOWN'}),request:{}});
  assert.equal(result.status,'UNMATCHED');
  assert.equal(queries.some((q)=>/UPDATE message_outbox/.test(q.sql)),false);
  assert.equal(queries.some((q)=>/INSERT INTO audit_events/.test(q.sql)),false);
});

test('unknown provider delivery status is rejected before mutation', async () => {
  const {db,queries}=makeDb();
  await assert.rejects(
    reconcileProviderCallbackTransaction(db,{provider:'wa',parseDeliveryStatus:async()=>({status:'BOGUS',provider_message_id:'WA-OUT-1'}),request:{}}),
    /UNKNOWN_PROVIDER_DELIVERY_STATUS/
  );
  assert.equal(queries.some((q)=>/UPDATE message_outbox/.test(q.sql)),false);
  assert.equal(queries.some((q)=>/INSERT INTO audit_events/.test(q.sql)),false);
});
