# Render Deployment Configuration Guide

## Overview
Your Project Sphere app is now configured to work with Render deployment. Environment variables have been set up to manage URLs for both frontend and backend across different environments (local development and production on Render).

---

## Environment Variables Setup

### Backend Configuration (`backend/.env`)
```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret
JWT_EXPIRE=7d
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
```

**For Render Production:** Update with your actual Render URLs:
```env
BACKEND_URL=https://YOUR-APP-BACKEND.onrender.com
FRONTEND_URL=https://YOUR-APP-FRONTEND.onrender.com
```

### Frontend Configuration (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_URL=http://localhost:5173
```

**For Render Production:** Update with your actual Render URLs:
```env
VITE_API_URL=https://YOUR-APP-BACKEND.onrender.com/api
VITE_APP_URL=https://YOUR-APP-FRONTEND.onrender.com
```

---

## How It Works

### Backend
- The **CORS** configuration in `backend/server.js` now uses `process.env.FRONTEND_URL` to allow requests only from the frontend
- This prevents CORS errors when deployed on Render

### Frontend
- All API calls now use `import.meta.env.VITE_API_URL` instead of hardcoded paths
- This works in:
  - `src/services/api.js` - centralized API service
  - `src/context/AuthContext.jsx` - authentication context
  - `src/pages/HomePage.jsx` - home page data fetching
  - `src/components/ChatPanel.jsx` - chat functionality
  - `src/components/ChatsListPanel.jsx` - chat list

### Local Development
- No changes needed - uses localhost URLs
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

---

## Steps to Deploy on Render

### 1. Backend Setup
1. Create a new **Web Service** on Render
2. Connect your GitHub repository
3. Set environment variables in Render dashboard:
   ```
   PORT=5000
   MONGODB_URI=<your-mongodb-uri>
   JWT_SECRET=<change-this-to-secure-value>
   JWT_EXPIRE=7d
   BACKEND_URL=https://<your-backend-name>.onrender.com
   FRONTEND_URL=https://<your-frontend-name>.onrender.com
   ```
4. Set Build Command: `cd backend && npm install`
5. Set Start Command: `cd backend && node server.js`

### 2. Frontend Setup
1. Create a new **Static Site** on Render
2. Connect your GitHub repository
3. Set environment variables in Render dashboard:
   ```
   VITE_API_URL=https://<your-backend-name>.onrender.com/api
   VITE_APP_URL=https://<your-frontend-name>.onrender.com
   ```
4. Set Build Command: `cd frontend && npm install && npm run build`
5. Publish Directory: `frontend/dist`

### 3. Important
- Replace `<your-backend-name>` and `<your-frontend-name>` with your actual Render service names
- Backend must be deployed first to get the correct URL
- Update Frontend's `VITE_API_URL` with the Backend URL

---

## Files Modified

1. **`backend/.env`** - Added BACKEND_URL and FRONTEND_URL
2. **`backend/.env.example`** - Example for reference and documentation
3. **`backend/server.js`** - Updated CORS to use `process.env.FRONTEND_URL`
4. **`frontend/.env`** - Created with Vite environment variables
5. **`frontend/.env.example`** - Example for reference
6. **`frontend/src/services/api.js`** - Uses `import.meta.env.VITE_API_URL`
7. **`frontend/src/context/AuthContext.jsx`** - Uses `import.meta.env.VITE_API_URL`
8. **`frontend/src/pages/HomePage.jsx`** - Uses `import.meta.env.VITE_API_URL`
9. **`frontend/src/components/ChatPanel.jsx`** - Uses `import.meta.env.VITE_API_URL`
10. **`frontend/src/components/ChatsListPanel.jsx`** - Uses `import.meta.env.VITE_API_URL`

---

## Testing Locally

1. Update `.env` files if needed (already set for localhost)
2. Backend: `cd backend && npm install && node server.js`
3. Frontend: `cd frontend && npm install && npm run dev`
4. Visit `http://localhost:5173` in your browser
5. All API calls should work with the backend at `http://localhost:5000`

---

## Troubleshooting

### CORS Errors
- Check that `FRONTEND_URL` in backend matches your frontend URL
- Verify both URLs are in the environment variables

### 404 Errors on API Calls
- Ensure `VITE_API_URL` in frontend `.env` points to correct backend
- Check that the URL includes `/api` path: `https://backend.onrender.com/api`

### Environment Variables Not Loading
- For Vite frontend, variables must start with `VITE_`
- Remember to rebuild/redeploy after changing `.env` files
- Backend needs to be restarted after `.env` changes

---

## Security Notes

- Never commit actual secrets to git - use `.env.example` as template
- Change `JWT_SECRET` to a strong, random value for production
- Use environment variables for all sensitive data
- `.env` files are already in `.gitignore` (if properly configured)
