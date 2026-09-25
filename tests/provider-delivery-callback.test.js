import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileProviderCallbackTransaction } from '../src/core/provider-delivery-callback.js';

test('provider callback composes parse, identity, canonical outbox mutation and audit', async () => {
  const queries=[];
  const db={transaction:async(fn)=>fn({async query(sql){queries.push(sql); if(/FROM message_outbox/.test(sql)) return {rows:[{outbox_id:'O1',conversation_id:'C1',provider:'wa',outbound_provider_message_id:'WA-OUT-1',inbound_id:'I1',inbound_provider_message_id:'WA-IN-1'}]}; if(/UPDATE message_outbox/.test(sql)) return {rows:[{id:'O1',delivery_state:'SENT',provider_message_id:'WA-OUT-1'}]}; if(/INSERT INTO audit_events/.test(sql)) return {rows:[{id:'A1'}]}; throw new Error('UNEXPECTED_SQL');}})};
  const result=await reconcileProviderCallbackTransaction(db,{provider:'wa',parseDeliveryStatus:async()=>({status:'DELIVERED',provider_message_id:'WA-OUT-1'}),request:{}});
  assert.equal(result.status,'RECONCILED');
  assert.equal(queries.filter((q)=>/UPDATE message_outbox/.test(q)).length,1);
  assert.equal(queries.filter((q)=>/INSERT INTO audit_events/.test(q)).length,1);
});

test('unknown provider callback cannot reach mutation or audit', async () => {
  const queries=[];
  const db={transaction:async(fn)=>fn({async query(sql){queries.push(sql); if(/FROM message_outbox/.test(sql)) return {rows:[]}; throw new Error('MUTATION_SHOULD_NOT_RUN');}})};
  const result=await reconcileProviderCallbackTransaction(db,{provider:'wa',parseDeliveryStatus:async()=>({status:'DELIVERED',provider_message_id:'UNKNOWN'}),request:{}});
  assert.equal(result.status,'UNMATCHED');
  assert.equal(queries.some((q)=>/UPDATE message_outbox/.test(q)),false);
  assert.equal(queries.some((q)=>/INSERT INTO audit_events/.test(q)),false);
});