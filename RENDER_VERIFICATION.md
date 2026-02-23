# Render Deployment Verification Checklist

## Current Deployment Status
- ✅ Backend deployed at: `https://project-sphere.onrender.com`
- ✅ Frontend built with fixes
- ✅ Fixed API call issues (StudentDashboard, ProjectDirectory, ProjectImport)

## Issues Fixed
1. ✅ `api.get()` not exported - Fixed in StudentDashboard.jsx (now uses axios.get)
2. ✅ `api.post()` not exported - Fixed in ProjectImport.jsx (now uses axios.post)
3. ✅ `api.get('/projects')` - Fixed in ProjectDirectory.jsx (now uses api.getAllProjects)

## What to Verify on Render

### Frontend Static Site Configuration
Check these environment variables are set in your Render Frontend dashboard:

```
VITE_API_URL=https://project-sphere.onrender.com/api
VITE_APP_URL=https://<your-frontend-url>.onrender.com
```

**How to verify:**
1. Go to your Frontend service on Render
2. Click "Environment" tab
3. Confirm both variables are set
4. If missing, add them and redeploy

### Backend Web Service Configuration  
Check these are set in your Render Backend dashboard:

```
FRONTEND_URL=https://<your-frontend-url>.onrender.com
BACKEND_URL=https://project-sphere.onrender.com
```

**How to verify:**
1. Go to your Backend service on Render
2. Click "Environment" tab
3. Confirm both variables are set
4. If missing, add them and redeploy

## Debugging the "Route not found" Error

If you see "Route not found" error on the admin registration page:

1. **Check Network Tab** (F12 → Network)
   - Look at API requests
   - Should be going to `https://project-sphere.onrender.com/api/...`
   - If seeing `/api/...` with relative path, it means frontend API URL isn't set

2. **Check Browser Console** (F12 → Console)
   - Look for CORS errors
   - Look for 404 errors from API calls

3. **Test Backend Directly**
   - Visit `https://project-sphere.onrender.com`
   - Should show: "Project Sphere Backend Running 🚀"
   - Visit `https://project-sphere.onrender.com/api/health`
   - Should return: `{"success":true,"message":"Server is running"}`

4. **Clear Cache and Redeploy**
   - On Frontend: Click "Deploy latest commit" in Render
   - Wait for deployment to complete
   - Clear browser cache (Ctrl+Shift+Delete)
   - Hard refresh (Ctrl+Shift+R)

## Expected Behavior After Fix

✅ Registration page should load without "Route not found"
✅ API calls should go to backend successfully
✅ Login/Register should work properly
✅ Dashboard should load with data from backend

## If Still Having Issues

1. **Check Render logs:**
   - Backend: Check application logs for connection errors
   - Frontend: Check build logs for environment variable issues

2. **Verify CORS:**
   - Make sure `FRONTEND_URL` in backend matches frontend URL exactly
   - Should include https:// and domain only (no trailing slash)

3. **Check API_URL in frontend:**
   - Should be `https://project-sphere.onrender.com/api`
   - Must include `/api` at the end

## Next Steps

After verifying environment variables:
1. Redeploy both services
2. Wait for both to show "Your site is live 🎉"
3. Clear browser cache
4. Test the admin registration page again
5. Test complete login flow (register → login → dashboard)
