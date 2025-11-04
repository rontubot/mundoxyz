const axios = require('axios');

const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyMDhkNWVhYi1kNmNlLTRiNTYtOWYxOC1mMzRiZmRiMjkzODEiLCJ0aW1lc3RhbXAiOjE3NjE2MTI2NjcyMzQsImlhdCI6MTc2MTYxMjY2NywiZXhwIjoxNzYyMjE3NDY3fQ.MfOTi_KbK10u-GkFcdMS8ZJeN59F9V2UfGg1CL6pL_8';
const API_URL = 'https://confident-bravery-production-ce7b.up.railway.app/api';

async function checkBalance() {
    try {
        console.log('💰 Verificando balance actual...');
        const response = await axios.get(`${API_URL}/economy/balance`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const balance = response.data;
        console.log('✅ Balance actual:');
        console.log(`   Coins: ${balance.coins_balance}`);
        console.log(`   Fires: ${balance.fires_balance}`);
        console.log(`   Usuario: ${balance.username}`);
        console.log(`   User ID: ${balance.user_id}`);
        
        return balance;
    } catch (error) {
        console.error('❌ Error obteniendo balance:', error.response?.data?.error || error.message);
        return null;
    }
}

checkBalance();
