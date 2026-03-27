const GATEWAY_URL = 'http://localhost:3000/api/gateway';
const MY_KEY = 'bf_6cf39de8bbe9a69a2ca75d86ca50425b25f3ef0e3153434bb78611b1214f239a';

async function test() {
  const r = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MY_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'test' }]
    })
  });
  console.log('Status:', r.status);
  const data = await r.json();
  console.log('Response:', data);
}
test();
