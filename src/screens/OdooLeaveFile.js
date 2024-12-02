import React, { useState } from "react";
import * as XLSX from "xlsx";

const OdooLeaveFile = () => {
  const [progressFile, setProgressFile] = useState(null);
  const [leaveFile, setLeaveFile] = useState(null);
  const [processedData, setProcessedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("Name");
  const [sortOrder, setSortOrder] = useState("asc");

  const handleProgressFileUpload = (e) => setProgressFile(e.target.files[0]);
  const handleLeaveFileUpload = (e) => setLeaveFile(e.target.files[0]);

  const processFiles = async () => {
    if (!progressFile || !leaveFile || !startDate || !endDate) {
      alert("Please upload both files and select a date range.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await correctProcessLeaveData(progressFile, leaveFile);
      setProcessedData(data);
      setIsLoading(false);
    } catch (error) {
      console.error("Error processing leave data:", error);
      alert("Failed to process files. Please check the console for details.");
      setIsLoading(false);
    }
  };

  const correctProcessLeaveData = async (progressFile, leaveFile) => {
    const readExcelFile = (file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const binaryData = e.target.result;
            const workbook = XLSX.read(binaryData, { type: "binary" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            resolve(jsonData);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
      });
    };
  
    try {
      // Read both files
      const progressData = await readExcelFile(progressFile);
      const leaveData = await readExcelFile(leaveFile);
  
      // Extract names and map original case for display purposes
      const progressNames = progressData
        .slice(5)
        .map((row) => ({ 
          original: row[0]?.trim(), 
          lowercase: row[0]?.trim().toLowerCase() 
        }))
        .filter((entry) => entry.lowercase);
  
      const leaveDates = leaveData[1]
        ?.slice(1)
        .map((date) => date?.trim())
        .filter(Boolean);
  
      if (!progressNames.length || !leaveDates.length) {
        throw new Error("No valid names or dates found in the provided files.");
      }
  
      const results = [];
  
      // Loop through each name in the progress file
      progressNames.forEach(({ original: originalName, lowercase: lowercaseName }) => {
        leaveData.forEach((row, rowIndex) => {
          const leaveName = row[0]?.trim().toLowerCase();
  
          if (leaveName === lowercaseName) {
            let leaveRowIndex = rowIndex + 1;
  
            // Process subsequent rows for leave types and durations
            while (leaveRowIndex < leaveData.length) {
              const leaveType = leaveData[leaveRowIndex][0]?.trim();
  
              if (!leaveType || progressNames.some(({ lowercase }) => lowercase === leaveType.toLowerCase())) {
                break;
              }
  
              leaveDates.forEach((date, colIndex) => {
                const duration = leaveData[leaveRowIndex][colIndex + 1];
                if (duration && String(duration).toLowerCase() !== "total") {
                  results.push({
                    Date: date,
                    Name: originalName, // Use the original casing
                    Duration: parseFloat(duration),
                    LeaveType: leaveType,
                  });
                }
              });
  
              leaveRowIndex++;
            }
          }
        });
      });
  
      return results.filter(
        (entry) => entry.Duration && entry.LeaveType && entry.Date && entry.Name
      );
    } catch (error) {
      throw new Error(`Error in processing leave data: ${error.message}`);
    }
  };

  const filteredAndSortedUsers = () => {
    const filteredData = processedData.filter(
      (item) =>
        (!searchTerm || item.Name.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (!startDate || new Date(item.Date) >= new Date(startDate)) &&
        (!endDate || new Date(item.Date) <= new Date(endDate))
    );

    const sortedData = [...filteredData].sort((a, b) => {
      const fieldA = sortBy === "Name" ? a.Name : a.EmployeeID;
      const fieldB = sortBy === "Name" ? b.Name : b.EmployeeID;
      const comparison = fieldA > fieldB ? 1 : fieldA < fieldB ? -1 : 0;
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return sortedData;
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(processedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leave Data");

    const fileName = `Processed_Odoo_Leave_Data.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center py-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Odoo Leave File Processor</h1>

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
      {processedData.length > 0 && (
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
                <option value="Name">Name</option>
                <option value="EmployeeID">Employee ID</option>
              </select>
              <button
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
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
                <th className="border border-gray-300 p-2">Date</th>
                <th className="border border-gray-300 p-2">Duration</th>
                <th className="border border-gray-300 p-2">Leave Type</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers().map((item, index) => (
                <tr key={index} className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                  <td className="border border-gray-300 p-2">{index + 1}</td>
                  <td className="border border-gray-300 p-2">{item.Name}</td>
                  <td className="border border-gray-300 p-2">{item.EmployeeID || "N/A"}</td>
                  <td className="border border-gray-300 p-2">{item.Date}</td>
                  <td className="border border-gray-300 p-2">{item.Duration}</td>
                  <td className="border border-gray-300 p-2">{item.LeaveType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OdooLeaveFile;
