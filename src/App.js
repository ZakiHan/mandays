import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./screens/Home";
import UploadPage_RawOrange from "./screens/UploadPage_RawOrange";
import UploadPage_RawOdoo from "./screens/UploadPage_RawOdoo";
import OdooLeaveFile from "./screens/OdooLeaveFile";

function App() {
  return (
    <Router>
      <Routes>
        {/* Define Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/processOdoo" element={<UploadPage_RawOdoo />} />
        <Route path="/processOrange" element={<UploadPage_RawOrange />} />
        <Route path="/processOdooLeave" element={<OdooLeaveFile />} />
        <Route
          path="*"
          element={<p>Page not found. Please use the navigation menu to go back.</p>}
        />
      </Routes>
    </Router>
  );
}

export default App;
