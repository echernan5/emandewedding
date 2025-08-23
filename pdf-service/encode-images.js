const fs = require('fs');
const path = require('path');

function encodeImage(filePath) {
  const file = fs.readFileSync(filePath);
  const base64 = Buffer.from(file).toString('base64');
  const mimeType = path.extname(filePath) === '.jpg' ? 'image/jpeg' : 'image/jpeg'; // Assuming both are JPEGs
  return `data:${mimeType};base64,${base64}`;
}

const monogramData = encodeImage(path.join(__dirname, 'monogram.jpg'));
const logotypeData = encodeImage(path.join(__dirname, 'logotype.jpg'));

console.log(`Monogram Data: ${monogramData}`);
console.log(`Logotype Data: ${logotypeData}`);