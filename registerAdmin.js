const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function registerAdmin() {
  const response = await fetch('http://localhost:9000/api/v1/auth/register/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'FarmFerry Admin',
      email: 'prathameshnarawade.delxn@gmail.com',
      password: 'pass123456'
    })
  });
  const data = await response.json();
  console.log(data);
}

registerAdmin(); 