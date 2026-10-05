const { authenticate } = require('./twenty-auth.cjs');
(async () => {
  const token = await authenticate();
  const response = await fetch(process.env.TWENTY_API_URL + '/metadata', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{findManyApplications{id name universalIdentifier canBeUninstalled} commandMenuItems{id label applicationId}}' }) });
  const result = await response.json();
  if (result.errors) throw new Error(JSON.stringify(result.errors));
  console.log(JSON.stringify(result.data, null, 2));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
