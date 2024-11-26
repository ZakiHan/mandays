import React, { useState } from "react";
import * as XLSX from "xlsx";

const UploadPage_RawOdoo= () => {
  const [progressFile, setProgressFile] = useState(null);
  const [leaveFile, setLeaveFile] = useState(null);
  const [users, setUsers] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleProgressFileUpload = (event) => {
    setProgressFile(event.target.files[0]);
  };

  const handleLeaveFileUpload = (event) => {
    setLeaveFile(event.target.files[0]);
  };

  const processFiles = () => {
    if (!progressFile || !leaveFile) {
      alert("Please upload both the progress and leave files.");
      return;
    }
    if (!startDate || !endDate) {
      alert("Please select a start and end date.");
      return;
    }

    setIsLoading(true);
    Promise.all([readFile(progressFile), readFile(leaveFile)]).then(
      ([progressData, leaveData]) => {
        processRows(progressData, leaveData);
      }
    );
  };

  const readFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const binaryData = e.target.result;
        const workbook = XLSX.read(binaryData, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        resolve(jsonData);
      };
      reader.readAsBinaryString(file);
    });
  };

  const processRows = (progressData, leaveData) => {
    const progressHeaders = progressData[2]; // Progress file headers
    const progressRows = progressData.slice(5); // Progress data rows
    const progressDateColumns = progressHeaders.slice(1);
  
    // Extract date headers
    const leaveHeaders = leaveData[0]; // Dates are in the first row
    const leaveRows = leaveData.slice(2); // Start from the third row
  
    // Parse dates and map leave data
    const leaveMap = {};
    for (let i = 0; i < leaveRows.length; i += 2) {
      const name = leaveRows[i][0]?.trim();
      if (!name) continue; // Skip invalid rows
      const leaveTypeRow = leaveRows[i + 1];
      const leaveDurations = leaveRows[i].slice(2);
  
      leaveDurations.forEach((duration, index) => {
        const dateHeader = leaveHeaders[index + 2];
        if (dateHeader && duration) {
          const [day, month, year] = dateHeader.split(" ");
          const formattedDate = new Date(`${month} ${day}, ${year}`);
          if (
            formattedDate >= new Date(startDate) &&
            formattedDate <= new Date(endDate)
          ) {
            if (!leaveMap[name]) leaveMap[name] = [];
            leaveMap[name].push({
              type: leaveTypeRow[index + 2]?.trim(),
              duration: parseFloat(duration || 0),
            });
          }
        }
      });
    }
  
    const parsedData = progressRows.map((row) => {
      const userName = row[0]?.trim();
      const dailyData = row.slice(1);
  
      const totalHours = dailyData.reduce((acc, hours, index) => {
        const dateHeader = progressDateColumns[index];
        if (!dateHeader || typeof dateHeader !== "string") return acc;
  
        const [day, month, year] = dateHeader.split(" ");
        const formattedDate = new Date(`${month} ${day}, ${year}`);
  
        if (
          formattedDate >= new Date(startDate) &&
          formattedDate <= new Date(endDate)
        ) {
          acc += parseFloat(hours || 0);
        }
        return acc;
      }, 0);
  
      let totalMandays = totalHours / 8; // Default mandays calculation
      let leavePaid = 0;
      let leaveUnpaid = 0;
      let leaveIllness = 0;
      let unAssignedTime = 0;
  
      if (leaveMap[userName]) {
        leaveMap[userName].forEach((leave) => {
          const { type, duration } = leave;
          const mandays = duration / 8;
  
          if (type === "Un-assigned Time") {
            unAssignedTime += mandays;
            totalMandays -= mandays;
          } else if (type === "Leave (UNPAID)") {
            leaveUnpaid += mandays;
            totalMandays -= mandays;
          } else if (type === "Illness") {
            leaveIllness += mandays;
            totalMandays -= mandays;
          } else {
            leavePaid += mandays;
          }
        });
      }
  
      return {
        userName,
        totalHours,
        mandays: totalMandays.toFixed(2),
        leavePaid: leavePaid.toFixed(2),
        leaveUnpaid: leaveUnpaid.toFixed(2),
        leaveIllness: leaveIllness.toFixed(2),
        unAssignedTime: unAssignedTime.toFixed(2),
        startDate,
        endDate,
      };
    });
  
    setUsers(parsedData);
    setIsLoading(false);
  };
  
  

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center py-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Upload and Process Data
      </h1>
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Upload Progress File
          </label>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleProgressFileUpload}
            className="p-2 border border-gray-300 rounded shadow-sm bg-white"
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Upload Leave File
          </label>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleLeaveFileUpload}
            className="p-2 border border-gray-300 rounded shadow-sm bg-white"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            Start Date:
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-2">
            End Date:
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-2 border border-gray-300 rounded"
          />
        </div>
      </div>
      <button
        onClick={processFiles}
        className="px-4 py-2 bg-blue-500 text-white rounded shadow-md hover:bg-blue-600"
      >
        Process Files
      </button>
      {isLoading && <p className="mt-4 text-gray-600">Processing data...</p>}
      {users.length > 0 && (
        <div className="w-full max-w-4xl bg-white p-6 shadow-md rounded mt-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Summary</h2>
          <table className="table-auto w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="border border-gray-300 p-2">Name</th>
                <th className="border border-gray-300 p-2">Total Hours</th>
                <th className="border border-gray-300 p-2">Mandays</th>
                <th className="border border-gray-300 p-2">Paid Leave</th>
                <th className="border border-gray-300 p-2">Unpaid Leave</th>
                <th className="border border-gray-300 p-2">Illness</th>
                <th className="border border-gray-300 p-2">Unassigned Time</th>
                <th className="border border-gray-300 p-2">Start Date</th>
                <th className="border border-gray-300 p-2">End Date</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, index) => (
                <tr
                  key={index}
                  className={`${
                    index % 2 === 0 ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <td className="border border-gray-300 p-2">
                    {user.userName}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {user.totalHours}
                  </td>
                  <td className="border border-gray-300 p-2">{user.mandays}</td>
                  <td className="border border-gray-300 p-2">
                    {user.leavePaid}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {user.leaveUnpaid}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {user.leaveIllness}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {user.unAssignedTime}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {user.startDate}
                  </td>
                  <td className="border border-gray-300 p-2">{user.endDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UploadPage_RawOdoo;
