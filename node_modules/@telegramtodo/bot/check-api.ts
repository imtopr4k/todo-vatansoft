
import fetch from 'node-fetch';

(async () => {
  try {
    console.log('Checking API connectivity...');
    const res = await fetch('http://localhost:8080/bot/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: Date.now() })
    });
    console.log('Status:', res.status);
    console.log('Text:', await res.text());
  } catch (e) {
    console.error('Failed:', e);
  }
})();
