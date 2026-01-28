require('dotenv').config();

const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

console.log("----- TOKEN DIAGNOSTICS -----");

if (!token) {
    console.error("ERROR: Token is undefined or empty.");
} else {
    console.log(`1. Token Length: ${token.length} characters`);
    console.log(`2. First 4 characters: '${token.substring(0, 4)}'`);
    console.log(`3. Last 4 characters:  '${token.substring(token.length - 4)}'`);
    
    if (token.startsWith('"') || token.startsWith("'")) {
        console.error("WARNING: Your token starts with a quote. Remove quotes from the .env file.");
    }
    if (token.startsWith(" ") || token.endsWith(" ")) {
        console.error("WARNING: Your token has empty spaces at the start or end.");
    }
}
console.log("-----------------------------");