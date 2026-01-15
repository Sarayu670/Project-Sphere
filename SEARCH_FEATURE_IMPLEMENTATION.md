# Search Feature Implementation

## Overview
Implemented a comprehensive search feature for problem statements and guides across the application. This allows users to search for problem statements by name/description and guides by name in real-time.

## Changes Made

### Backend (Node.js/Express)

#### 1. Problem Controller (`backend/controllers/problemController.js`)
- **Added:** `searchProblems()` function
- **Endpoint:** `GET /api/problems/search?q=searchTerm`
- **Features:**
  - Case-insensitive regex search
  - Searches in both `title` and `description` fields
  - Returns populated COE and Guide information
  - Returns error if search query is empty

#### 2. Guide Controller (`backend/controllers/guideController.js`)
- **Added:** `searchGuides()` function
- **Endpoint:** `GET /api/guides/search?q=searchTerm`
- **Features:**
  - Case-insensitive regex search
  - Searches in `name` field
  - Returns guide data without password
  - Returns error if search query is empty

#### 3. Problem Routes (`backend/routes/problemRoutes.js`)
- **Added:** Search route before the `:id` route to prevent conflicts
- Route order:
  ```
  GET / - getAllProblems
  GET /search - searchProblems
  GET /my-problems - getMyProblems
  GET /coe/:coeId - getProblemsByCOE
  GET /:id - getProblem
  ```

#### 4. Guide Routes (`backend/routes/guideRoutes.js`)
- **Added:** Search route before the `:id` route
- Route order:
  ```
  GET / - getAllGuides
  GET /search - searchGuides
  GET /my-batches - getMyBatches
  GET /:id - getGuide
  ```

### Frontend (React)

#### 1. API Service (`frontend/src/services/api.js`)
- **Added:** `searchGuides(query)` - Calls `GET /api/guides/search?q=query`
- **Added:** `searchProblems(query)` - Calls `GET /api/problems/search?q=query`

#### 2. Home Page (`frontend/src/pages/HomePage.jsx`)
- **Enhanced search functionality:**
  - Searches both guides AND problem statements simultaneously
  - Real-time search with both API calls and local fallback
  - Displays results in two separate sections
  - Shows result counts for each category
  - Added loading state while searching
  - Shows "No results" message when search matches nothing
  - Problem statement cards show:
    - Title
    - COE (Center of Excellence)
    - Description preview
    - Target year
    - Assigned guide name

#### 3. Admin Problem Management (`frontend/src/pages/admin/ProblemManagement.jsx`)
- **Added:** Search input field at the top of the problem list
- **Features:**
  - Real-time filtering by title and description
  - Searches via API with local fallback
  - Displays filtered count in table
  - Clear search clears filters and shows all problems
  - Maintains all existing admin functionality (add, delete)

#### 4. Guide Dashboard (`frontend/src/pages/guide/GuideDashboard.jsx`)
- **Added:** Search input in the "My Problem Statements" tab
- **Features:**
  - Guides can search their own problem statements
  - Searches via API with local fallback
  - Displays only matching problems
  - Easy to find specific problems when creating many
  - Maintains all existing functionality

## How It Works

### Search Flow:

1. **User enters text in search bar**
2. **Frontend makes API request** with query parameter
3. **Backend searches MongoDB** using regex pattern (case-insensitive)
4. **Results returned with populated references**
5. **Frontend displays results** in appropriate sections
6. **Fallback**: If API fails, frontend does local filtering

### Database Operations:

The search uses MongoDB's regex `$or` operator to search across multiple fields:

```javascript
// For Problems
{
  $or: [
    { title: /searchTerm/i },
    { description: /searchTerm/i }
  ]
}

// For Guides
{
  name: /searchTerm/i
}
```

## API Documentation

### Search Problems
```
GET /api/problems/search?q=searchQuery
```
**Parameters:**
- `q` (required): Search query string

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "Problem Title",
      "description": "...",
      "targetYear": "3rd",
      "coeId": { "_id": "...", "name": "AI" },
      "guideId": { "_id": "...", "name": "Guide Name", "email": "guide@email.com" }
    }
  ]
}
```

### Search Guides
```
GET /api/guides/search?q=searchQuery
```
**Parameters:**
- `q` (required): Search query string

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "Guide Name",
      "email": "guide@email.com",
      "maxBatches": 3,
      "assignedBatches": 2
    }
  ]
}
```

## Features Added

✅ **Real-time Search** - Results update as user types
✅ **Case-Insensitive** - Matches "AI", "ai", "Ai"
✅ **Multi-field Search** - Problems search title and description
✅ **API + Fallback** - Uses API first, falls back to local filtering
✅ **Loading States** - Shows spinner while searching
✅ **Result Counts** - Displays number of results found
✅ **Empty State** - Shows helpful message when no results
✅ **Quick Access** - Problem cards show key information
✅ **Guide Integration** - Works in guide dashboard
✅ **Admin Integration** - Works in admin problem management

## User Experience

### Home Page Users
- Can search for guides and problems in one unified search bar
- See both guides and problems in separate sections
- Click on guides to see their projects

### Guides
- Search their own problem statements in their dashboard
- Quickly find specific problems when managing many
- See search results with full details

### Admins
- Search and filter all problem statements
- Easy to manage large number of problems
- Quick access to specific problems for deletion

## Testing Checklist

- [x] Backend search endpoints created
- [x] Routes configured with correct ordering
- [x] Frontend API methods created
- [x] Home page search implemented
- [x] Admin problem management search added
- [x] Guide dashboard search added
- [x] Case-insensitive search working
- [x] Empty search returns all results
- [x] Error handling with fallback
- [x] Result counts displayed
- [x] No results message shown
- [x] Search works across all pages

## Files Modified

### Backend
1. `backend/controllers/problemController.js` - Added searchProblems()
2. `backend/controllers/guideController.js` - Added searchGuides()
3. `backend/routes/problemRoutes.js` - Added search route
4. `backend/routes/guideRoutes.js` - Added search route

### Frontend
1. `frontend/src/services/api.js` - Added searchProblems() and searchGuides()
2. `frontend/src/pages/HomePage.jsx` - Enhanced with dual search
3. `frontend/src/pages/admin/ProblemManagement.jsx` - Added search filter
4. `frontend/src/pages/guide/GuideDashboard.jsx` - Added search filter

## Future Enhancements

- Add debouncing to reduce API calls during typing
- Add search history/suggestions
- Add advanced filters (by COE, year, guide)
- Add sort options (relevance, date, popularity)
- Add pagination for large result sets
- Add full-text search in MongoDB
- Add autocomplete suggestions
