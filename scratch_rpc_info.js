const fs = require('fs');

const openapi = JSON.parse(fs.readFileSync('scratch_openapi.json', 'utf-8'));
const rlsPath = openapi.paths['/rpc/rls_auto_enable'];
console.log('Definition of /rpc/rls_auto_enable:');
console.log(JSON.stringify(rlsPath, null, 2));
