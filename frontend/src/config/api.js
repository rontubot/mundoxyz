// API URL configuration for fetch requests
// In production, REACT_APP_API_URL should be the backend URL
// In development, empty string uses relative paths (handled by proxy)

const apiUrl = process.env.REACT_APP_API_URL;

const API_URL = apiUrl && apiUrl !== '' 
  ? (apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl)
  : '';

export default API_URL;
