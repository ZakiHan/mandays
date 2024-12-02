import React from "react";
import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center py-10 px-6">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">
        Welcome to the Upload Portal
      </h1>
      <p className="text-lg text-gray-600 mb-12 text-center">
        Select an option below to upload and process your data efficiently.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Process Odoo Data */}
        <Link
          to="/processOdoo"
          className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center hover:shadow-xl transition-shadow duration-200"
        >
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Process Odoo Data
          </h2>
          <p className="text-sm text-gray-500 text-center">
            Upload and process Odoo data for insights and analysis.
          </p>
        </Link>

        {/* Process Orange Data */}
        <Link
          to="/processOrange"
          className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center hover:shadow-xl transition-shadow duration-200"
        >
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Process Orange Data
          </h2>
          <p className="text-sm text-gray-500 text-center">
            Upload and manage your Orange data with ease.
          </p>
        </Link>

        {/* Process Odoo Leave File */}
        <Link
          to="/processOdooLeave"
          className="bg-white rounded-lg shadow-lg p-6 flex flex-col items-center hover:shadow-xl transition-shadow duration-200"
        >
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Process Odoo Leave File
          </h2>
          <p className="text-sm text-gray-500 text-center">
            Reformat and manage Odoo leave files.
          </p>
        </Link>
      </div>
    </div>
  );
}

export default Home;
