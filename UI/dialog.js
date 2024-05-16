const { ipcRenderer } = require('electron');

document.getElementById('input-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const url = document.getElementById('url').value.trim();
  if (url === '') {
    alert('Please enter a URL');
  } else if (!isValidPerplexityURL(url)) {
    alert('Please enter a valid Perplexity login URL.');
  } else {
    ipcRenderer.send('submit-input', url);
    window.close(); // Close the popup
  }
});

function isValidPerplexityURL(string) {
  const urlPattern = /^https:\/\/www\.perplexity\.ai\/api\/auth\/callback\/email/;
  if (!urlPattern.test(string)) {
    return false; // Base URL check
  }

  try {
    const url = new URL(string);
    // Check for required query parameters
    return url.searchParams.has('callbackUrl') && 
           url.searchParams.has('token') && 
           url.searchParams.has('email');
  } catch (error) {
    return false; // Not a valid URL
  }
}