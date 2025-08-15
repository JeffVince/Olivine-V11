import { CallSheetAgent, CallSheetEnvelope } from '../../agents/CallSheetAgent/CallSheetAgent';
import { OlivineClient } from '../../client/OlivineClient';

test('CallSheetAgent consumes envelope and commits provenance', async () => {
  const client = new OlivineClient();
  const agent = new CallSheetAgent(client);
  const envelope: CallSheetEnvelope = { orgId: 'org1', callSheet: { scene: '1A' } };

  agent.enqueue(envelope);
  await agent.runOnce();

  expect(client.commits).toHaveLength(1);
  expect(client.commits[0]).toMatchObject({ orgId: 'org1', payload: { scene: '1A' } });
});
