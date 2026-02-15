import React from 'react'
import {Route, Routes} from "react-router-dom";
import Home from "./pages/Home.jsx";
import Auth from "./pages/Auth.jsx";
import Dashboard from "./pages/dashboard.jsx";
import Admin from "./pages/Admin.jsx";
import {Toaster} from "react-hot-toast";
import Navbar from "./components/Navbar.jsx";
import Reports from "./pages/Reports.jsx";

const App = () => {
    return (
        <div>
            <Toaster/>
            <Navbar/>
            <main className={"m-3"}>
                <Routes>
                    <Route path={"/"} element={<Home/>}/>
                    <Route path="/auth/login" element={<Auth type={"login"}/>}/>
                    <Route path="/auth/signin" element={<Auth type={"signin"}/>}/>
                    <Route path="/dashboard" element={<Dashboard/>}/>
                    <Route path="/admin" element={<Admin/>}/>
                    <Route path="/reports" element={<Reports/>}/>
                    <Route path="/report/:id" element={<Reports/>}/>
                </Routes>
            </main>
        </div>
    )
}
export default App
