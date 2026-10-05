async function authenticate({ loginOnly = false } = {}) {
  if (process.env.TWENTY_API_KEY && !loginOnly) return process.env.TWENTY_API_KEY;
  const url = process.env.TWENTY_API_URL;
  if(!url || !process.env.TWENTY_WORKSPACE_ID || !process.env.TWENTY_PUBLIC_URL) throw new Error('Configure TWENTY_API_URL, TWENTY_PUBLIC_URL, and TWENTY_WORKSPACE_ID');
  const graphql = async (query, variables) => {
    const result = await fetch(url+'/metadata',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables})}).then(r=>r.json());
    if(result.errors) throw new Error(result.errors.map(e=>e.message).join('; '));
    return result.data;
  };
  const signed = await graphql('mutation($email:String!,$password:String!){signIn(email:$email,password:$password){availableWorkspaces{availableWorkspacesForSignIn{id loginToken}}}}',{email:process.env.TWENTY_EMAIL,password:process.env.TWENTY_PASSWORD});
  const workspace = signed.signIn.availableWorkspaces.availableWorkspacesForSignIn.find(w=>w.id===process.env.TWENTY_WORKSPACE_ID);
  if(!workspace) throw new Error('Local workspace not available');
  if (loginOnly) return workspace.loginToken;
  const access = await graphql('mutation($loginToken:String!,$origin:String!){getAuthTokensFromLoginToken(loginToken:$loginToken,origin:$origin){tokens{accessOrWorkspaceAgnosticToken{token}}}}',{loginToken:workspace.loginToken,origin:process.env.TWENTY_PUBLIC_URL});
  return access.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;
}
module.exports = {authenticate};
