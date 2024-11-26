import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import moment from "moment";

const DailyDataPage = () => {
  const [file1Data, setFile1Data] = useState([]);
  const [file2Data, setFile2Data] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [displayData, setDisplayData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleFileUpload = (event, setFileData) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const binaryData = e.target.result;
        const workbook = XLSX.read(binaryData, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        setFileData(jsonData);
      };
      reader.readAsBinaryString(file);
    }
  };

  const processFiles = () => {
    setIsLoading(true);

    const filterByDateRange = (data) => {
      return data.filter((row) => {
        const rowDate = moment(row.date || row.Date, ["YYYY-MM-DD", "DD/MM/YYYY"]).format(
          "YYYY-MM-DD"
        );
        return moment(rowDate).isBetween(startDate, endDate, "day", "[]");
      });
    };

    const progressData = filterByDateRange(
      file1Data.map((row) => {
        const { Date, Duration, Firstname, Lastname, EmployeeID } = row;
        const date = moment(Date, ["YYYY-MM-DD", "DD/MM/YYYY"]).format("YYYY-MM-DD");
        return {
          date,
          duration: parseFloat(Duration || 0),
          name: `${Firstname} ${Lastname}`,
          employeeId: EmployeeID,
        };
      })
    );

    const leaveData = filterByDateRange(
      file2Data.map((row) => {
        const { date, length_hours, emp_firstname, emp_lastname, employee_id } = row;
        const formattedDate = moment(date, ["YYYY-MM-DD", "DD/MM/YYYY"]).format("YYYY-MM-DD");
        return {
          date: formattedDate,
          duration: parseFloat(length_hours || 0),
          name: `${emp_firstname} ${emp_lastname}`,
          employeeId: employee_id,
        };
      })
    );

    const combinedData = [...progressData, ...leaveData];

    const dailyData = combinedData.reduce((acc, row) => {
      const { date, duration, name, employeeId } = row;

      if (!acc[name]) {
        acc[name] = { name, employeeId, daily: {} };
      }

      acc[name].daily[date] = (acc[name].daily[date] || 0) + duration;
      return acc;
    }, {});

    const formattedData = Object.values(dailyData).map((entry) => {
      const days = {};
      let totalDuration = 0;

      const start = moment(startDate);
      const end = moment(endDate);

      while (start.isSameOrBefore(end)) {
        const day = start.format("YYYY-MM-DD");
        days[day] = entry.daily[day] || 0;
        totalDuration += days[day];
        start.add(1, "day");
      }

      return {
        name: entry.name,
        employeeId: entry.employeeId,
        days,
        totalDuration,
      };
    });

    setProcessedData(formattedData);
    setDisplayData(formattedData);
    setIsLoading(false);
  };

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center py-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Daily Data Viewer
      </h1>
      <div className="flex space-x-6 mb-6">
        <div>
          <h2 className="font-medium text-gray-700 mb-2">Upload Progress File</h2>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => handleFileUpload(e, setFile1Data)}
            className="p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <h2 className="font-medium text-gray-700 mb-2">Upload Leave File</h2>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={(e) => handleFileUpload(e, setFile2Data)}
            className="p-2 border border-gray-300 rounded"
          />
        </div>
      </div>
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
      <button
        onClick={processFiles}
        className="px-6 py-2 bg-blue-500 text-white rounded shadow-md"
        disabled={isLoading || !file1Data.length || !file2Data.length || !startDate || !endDate}
      >
        {isLoading ? "Processing..." : "Process Files"}
      </button>
      {displayData.length > 0 && (
        <div className="w-full overflow-auto bg-white p-6 mt-8 shadow-md rounded">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Daily Data</h2>
          <table className="table-auto w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-300 p-2">Name</th>
                <th className="border border-gray-300 p-2">Employee ID</th>
                {Object.keys(displayData[0].days).map((date) => (
                  <th key={date} className="border border-gray-300 p-2">{moment(date).format("DD-MMM")}</th>
                ))}
                <th className="border border-gray-300 p-2">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((item, index) => (
                <tr key={index}>
                  <td className="border border-gray-300 p-2">{item.name}</td>
                  <td className="border border-gray-300 p-2">{item.employeeId}</td>
                  {Object.values(item.days).map((day, i) => (
                    <td key={i} className="border border-gray-300 p-2">{day.toFixed(2)}</td>
                  ))}
                  <td className="border border-gray-300 p-2">{item.totalDuration.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DailyDataPage;
