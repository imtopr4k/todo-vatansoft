import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import Stats from './pages/Stats';
import Analysis from './pages/Analysis';
import { me } from './auth';
import './styles.css';

function RequireAuth({ children }: { children: JSX.Element }) {
  const user = me();
  return user ? children : <Navigate to="/login" replace/>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login/>} />
        <Route path="/" element={<RequireAuth><Dashboard/></RequireAuth>} />
        <Route path="/tickets" element={<RequireAuth><Tickets/></RequireAuth>} />
        <Route path="/stats" element={<RequireAuth><Stats/></RequireAuth>} />
  <Route path="/analysis" element={<RequireAuth><Analysis/></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
