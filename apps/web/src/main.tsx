import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import Chat from './pages/Chat';
import Stats from './pages/Stats';
import Analysis from './pages/Analysis';
import AdminUsers from './pages/AdminUsers';
import Test1907 from './pages/Test1907';
import Logs from './pages/Logs';
import { SystemStatus } from './Components/SystemStatus';
import { me } from './auth';
import './styles.css';

function RequireAuth({ children }: { children: JSX.Element }) {
  const user = me();
  return user ? children : <Navigate to="/login" replace/>;
}

function RequireSupervisor({ children }: { children: JSX.Element }) {
  const user = me();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'supervisor' ? children : <Navigate to="/" replace />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SystemStatus />
      <Routes>
        <Route path="/login" element={<Login/>} />
        <Route path="/" element={<RequireAuth><Dashboard/></RequireAuth>} />
        <Route path="/tickets" element={<RequireAuth><Tickets/></RequireAuth>} />
        <Route path="/chat" element={<RequireAuth><Chat/></RequireAuth>} />
        <Route path="/stats" element={<RequireAuth><Stats/></RequireAuth>} />
  <Route path="/analysis" element={<RequireAuth><Analysis/></RequireAuth>} />
    <Route path="/admin" element={<RequireSupervisor><AdminUsers/></RequireSupervisor>} />
        <Route path="/test1907" element={<RequireAuth><Test1907/></RequireAuth>} />
        <Route path="/logs" element={<RequireAuth><Logs/></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
