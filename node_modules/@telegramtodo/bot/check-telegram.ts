
import fetch from 'node-fetch';

(async () => {
  try {
    console.log('Checking Telegram connectivity...');
    const res = await fetch('https://api.telegram.org');
    console.log('Status:', res.status);
    console.log('Text:', await res.text());
  } catch (e) {
    console.error('Failed:', e);
  }
})();
