const fs = require('fs');

const openapi = JSON.parse(fs.readFileSync('scratch_openapi.json', 'utf-8'));

function printTable(tableName) {
  const definition = openapi.definitions[tableName];
  if (!definition) {
    console.log(`Table ${tableName} not found.`);
    return;
  }
  const properties = definition.properties;
  console.log(`\nColumns of ${tableName}:`);
  Object.keys(properties).forEach(prop => {
    console.log(` - ${prop}: type=${properties[prop].type}, description=${properties[prop].description || 'none'}`);
  });
}

printTable('stock');
