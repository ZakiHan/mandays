import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import axios from "axios";

const UploadPage_RawOdoo = () => {
  const [progressFile, setProgressFile] = useState(null);
  const [leaveFile, setLeaveFile] = useState(null);
  const [users, setUsers] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("userName");
  const [sortOrder, setSortOrder] = useState("asc");


  // Fetch public holidays from API on mount
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const response = await axios.get("https://api.npoint.io/1e42e5185b019eefe616");
        setPublicHolidays(response.data);
      } catch (error) {
        console.error("Error fetching public holidays:", error);
        setPublicHolidays([]); // Fallback to empty array if the API call fails
      }
    };
    fetchHolidays();
  }, []);

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
    const progressHeaders = progressData[2]; // Row containing the headers
  
    // Normalize a date to the GMT+7 timezone
    const normalizeToGMT7 = (date) => {
      const localDate = new Date(date);
      return new Date(
        localDate.getFullYear(),
        localDate.getMonth(),
        localDate.getDate(),
        localDate.getHours() + 7
      );
    };
  
    // Normalize headers to consistent format (YYYY-MM-DD)
    const headerDateMap = {};
    progressHeaders.slice(1).forEach((header, index) => {
      const parsedDate = new Date(header.trim());
      if (!isNaN(parsedDate)) {
        const normalizedDate = normalizeToGMT7(parsedDate).toISOString().split("T")[0];
        headerDateMap[normalizedDate] = index;
      }
    });
  
    const normalizedStartDate = normalizeToGMT7(new Date(startDate)).toISOString().split("T")[0];
    const normalizedEndDate = normalizeToGMT7(new Date(endDate)).toISOString().split("T")[0];
  
    const filteredDates = Object.keys(headerDateMap).filter((date) => {
      return date >= normalizedStartDate && date <= normalizedEndDate;
    });
  
    const normalizedHolidays = publicHolidays.map((holiday) =>
      normalizeToGMT7(new Date(holiday)).toISOString().split("T")[0]
    );
  
    // Build leave map
    const leaveMap = {};
    leaveData.slice(1).forEach((row) => {
      const [date, name, duration, leaveType, activityName] = row;
      if (!name || !date || !duration) return;
  
      const formattedDate = normalizeToGMT7(new Date(date)).toISOString().split("T")[0];
      if (!formattedDate) return;
  
      if (formattedDate >= normalizedStartDate && formattedDate <= normalizedEndDate) {
        if (!leaveMap[name]) leaveMap[name] = {};
        leaveMap[name][formattedDate] = {
          type: leaveType ? leaveType.trim() : null,
          activity: activityName ? activityName.trim() : null,
          duration: parseFloat(duration || 0) * 8, // Convert to hours
        };
      }
    });
  
    const progressRows = progressData.slice(5); // Rows containing the actual data
  
    const parsedData = progressRows.map((row) => {
      const userName = row[0]?.trim();
      const dailyData = row.slice(1);
  
      let totalMandays = 0;
      let leavePaid = 0;
      let leaveUnpaid = 0;
      let leaveIllness = 0;
      let unAssignedTime = 0;
      let unAssignedCount = 0;
      let overtime = 0;
  
      const totalHours = filteredDates.reduce((acc, dateKey) => {
        const columnIndex = headerDateMap[dateKey];
        if (columnIndex === undefined) return acc;
  
        const validHours = parseFloat(dailyData[columnIndex] || 0);
  
        const isHoliday = normalizedHolidays.includes(dateKey);
        const isWeekend = new Date(dateKey).getDay() === 0 || new Date(dateKey).getDay() === 6;
  
        // Check for leave data
        const leave = leaveMap[userName]?.[dateKey];
  
        if (leave) {
          const mandays = leave.duration / 8; // Convert hours to mandays
  
          if (leave.activity === "Un-assigned Time") {
            unAssignedTime += mandays;
            totalMandays -= mandays; // Deduct unassigned time from mandays
            unAssignedCount += 1;
          } else if (leave.type === "Leave (UNPAID)") {
            leaveUnpaid += mandays;
          } else if (leave.type === "Illness") {
            leaveIllness += mandays;
          } else if (leave.type) {
            leavePaid += mandays; // Count paid leave
            totalMandays += mandays; // Add paid leave to mandays
          }
  
          // Deny progress hours on leave dates
          return acc;
        }
  
        if (validHours > 0) {
          const mandaysForDay = validHours / 8 > 1 ? 1 : validHours / 8;
  
          if (isHoliday || isWeekend) {
            overtime += validHours / 8 > 1 ? 1 : validHours / 8;
          } else {
            totalMandays += mandaysForDay;
          }
          acc += validHours;
        }
        return acc;
      }, 0);
  
      return {
        userName,
        totalHours,
        mandays: totalMandays.toFixed(2),
        leavePaid: leavePaid.toFixed(2),
        leaveUnpaid: leaveUnpaid.toFixed(2),
        leaveIllness: leaveIllness.toFixed(2),
        unAssignedTime: unAssignedTime.toFixed(2),
        unAssignedCount,
        overtime: overtime.toFixed(2),
        startDate,
        endDate,
      };
    });
  
    setUsers(parsedData);
    setIsLoading(false);
  };
  
  const filteredAndSortedUsers = () => {
    let filteredUsers = users.filter((user) =>
      user.userName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filteredUsers.sort((a, b) => {
      if (sortOrder === "asc") {
        return a[sortBy] > b[sortBy] ? 1 : -1;
      } else {
        return a[sortBy] < b[sortBy] ? 1 : -1;
      }
    });

    return filteredUsers;
  };

  const exportToExcel = () => {
    const formattedData = users.map((user, index) => ({
      No: index + 1,
      Name: user.userName,
      EmployeeID: "", // Add logic if EmployeeID exists
      "Start Date": user.startDate,
      "End Date": user.endDate,
      "Total Duration": user.totalHours,
      Mandays: user.mandays,
      Overtime: user.overtime,
      "Leave (Paid)": user.leavePaid,
      "Leave (Illness)": user.leaveIllness,
      "Un-assigned": user.unAssignedTime,
      "Leave (Unpaid)": user.leaveUnpaid,
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

    const fileName = `OdooData_${startDate}_to_${endDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };
  
  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center py-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Upload and Process Data
      </h1>
  
      {/* File Upload Section */}
      <div className="flex space-x-6 mb-6">
        <div>
          <h2 className="font-medium text-gray-700 mb-2">Upload Progress File</h2>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleProgressFileUpload}
            className="p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <h2 className="font-medium text-gray-700 mb-2">Upload Leave File</h2>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleLeaveFileUpload}
            className="p-2 border border-gray-300 rounded"
          />
        </div>
      </div>
  
      {/* Date Range Section */}
      <div className="flex space-x-4 mb-6">
        <div>
          <label className="font-medium text-gray-700">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="font-medium text-gray-700">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-2 border border-gray-300 rounded"
          />
        </div>
      </div>
  
      {/* Process Button */}
      <button
        onClick={processFiles}
        className="px-6 py-2 bg-blue-500 text-white rounded shadow-md"
        disabled={isLoading || !progressFile || !leaveFile || !startDate || !endDate}
      >
        {isLoading ? "Processing..." : "Process Files"}
      </button>
  
      {/* Search and Sorting Section */}
      {users.length > 0 && (
        <div className="w-full overflow-auto bg-white p-6 mt-8 shadow-md rounded">
          <div className="flex justify-between items-center mb-4">
            <div>
              <label className="font-medium text-gray-700">Search by Name:</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name..."
                className="ml-2 p-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="font-medium text-gray-700">Sort By:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="ml-2 p-2 border border-gray-300 rounded"
              >
                <option value="userName">Name</option>
                <option value="EmployeeID">Employee ID</option>
              </select>
              <button
                onClick={() =>
                  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
                }
                className="ml-2 p-2 bg-gray-200 border border-gray-300 rounded"
              >
                {sortOrder === "asc" ? "Asc" : "Desc"}
              </button>
            </div>
            <button
              onClick={exportToExcel}
              className="p-2 bg-green-500 text-white rounded shadow-md"
            >
              Export to Excel
            </button>
          </div>
  
          {/* Data Table */}
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Processed Data</h2>
          <table className="table-auto w-full whitespace-nowrap border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="border border-gray-300 p-2">No.</th>
                <th className="border border-gray-300 p-2">Name</th>
                <th className="border border-gray-300 p-2">Employee ID</th>
                <th className="border border-gray-300 p-2">Start Date</th>
                <th className="border border-gray-300 p-2">End Date</th>
                <th className="border border-gray-300 p-2">Total Duration</th>
                <th className="border border-gray-300 p-2">Mandays</th>
                <th className="border border-gray-300 p-2">Overtime</th>
                <th className="border border-gray-300 p-2">Leave (Paid)</th>
                <th className="border border-gray-300 p-2">Leave (Illness)</th>
                <th className="border border-gray-300 p-2">Un-assigned</th>
                <th className="border border-gray-300 p-2">Leave (Unpaid)</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers().map((user, index) => (
                <tr
                  key={index}
                  className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                >
                  <td className="border border-gray-300 p-2">{index + 1}</td>
                  <td className="border border-gray-300 p-2">{user.userName}</td>
                  <td className="border border-gray-300 p-2">{user.employeeId}</td>
                  <td className="border border-gray-300 p-2">{user.startDate}</td>
                  <td className="border border-gray-300 p-2">{user.endDate}</td>
                  <td className="border border-gray-300 p-2">{user.totalHours}</td>
                  <td className="border border-gray-300 p-2">{user.mandays}</td>
                  <td className="border border-gray-300 p-2">{user.overtime}</td>
                  <td className="border border-gray-300 p-2">{user.leavePaid}</td>
                  <td className="border border-gray-300 p-2">{user.leaveIllness}</td>
                  <td className="border border-gray-300 p-2">{user.unAssignedTime}</td>
                  <td className="border border-gray-300 p-2">{user.leaveUnpaid}</td>
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