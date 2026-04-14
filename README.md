# Project-Sphere

Project-Sphere is a comprehensive project management and coordination platform designed to streamline the interaction between administrators, guides (mentors), and students. It facilitates task tracking, meeting scheduling, submission reviews, and overall project monitoring.

## Features

- **Multi-role Dashboard**: Distinct interfaces for Admins, Guides, and Students.
- **Meeting Management**: Schedule and track project meetings.
- **Submission Tracking**: Upload and review project submissions with feedback loops.
- **Timeline Management**: visualize and manage project milestones.
- **Batch & Section Filtering**: Organize students and projects by batch and section.
- **Automated Notifications**: Email alerts via Nodemailer for critical updates.
- **Reporting**: Export data to PDF and Excel formats.

## Tech Stack

- **Frontend**: React.js with Vite
- **Backend**: Node.js with Express.js
- **Database**: MongoDB (Mongoose)
- **Styling**: Vanilla CSS (Custom UI)
- **Authentication**: JWT (JSON Web Tokens) with Bcryptjs
- **File Handling**: Multer (for uploads)

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/)
- [MongoDB](https://www.mongodb.com/try/download/community) (Local or Atlas)

## Project Structure

```text
Project-Sphere/
├── frontend/     # React frontend application
├── backend/      # Node.js/Express backend API
├── package.json  # Root package file
└── README.md     # Project documentation
```

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Project-Sphere
   ```

2. **Install Root Dependencies**:
   ```bash
   npm install
   ```

3. **Install Backend Dependencies**:
   ```bash
   cd backend
   npm install
   ```

4. **Install Frontend Dependencies**:
   ```bash
   cd ../frontend
   npm install
   ```

## Environment Configuration

Both the frontend and backend require environment variables to function correctly.

### Backend Setup
Create a `.env` file in the `backend/` directory based on `backend/.env.example`:
- `PORT`: Server port (default: 5000)
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Secret key for authentication
- `JWT_EXPIRE`: Token expiration time (e.g., 7d)
- `BACKEND_URL`: URL of the backend server
- `FRONTEND_URL`: URL of the frontend application

### Frontend Setup
Create a `.env` file in the `frontend/` directory based on `frontend/.env.example`:
- `VITE_API_URL`: Backend API endpoint (default: http://localhost:5000/api)
- `VITE_APP_URL`: Frontend application URL (default: http://localhost:5173)

## Running the Application

### Start the Backend
```bash
cd backend
npm run dev
```

### Start the Frontend
```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173` by default.

## Requirements

### Backend Dependencies
- `express`: Web framework
- `mongoose`: MongoDB object modeling
- `jsonwebtoken`: Authentication
- `bcryptjs`: Password hashing
- `multer`: File uploads
- `nodemailer`: Email services
- `cors`: Cross-Origin Resource Sharing
- `dotenv`: Environment variable management
- `express-validator`: Input validation
- `pdf-parse`: PDF processing
- `xlsx`: Excel file processing

### Frontend Dependencies
- `react`: UI library
- `react-dom`: Browser rendering
- `react-router-dom`: Client-side routing
- `axios`: API requests
- `vite`: Build tool
- `jspdf` & `jspdf-autotable`: PDF generation
- `xlsx`: Excel processing

