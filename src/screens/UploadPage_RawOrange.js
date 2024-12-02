import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import moment from "moment";
import axios from "axios";

const UploadPage_RawOrange = () => {
  const [file1Data, setFile1Data] = useState([]);
  const [file2Data, setFile2Data] = useState([]);
  const [processedData, setProcessedData] = useState([]);
  const [dailyDetails, setDailyDetails] = useState([]);
  const [displayData, setDisplayData] = useState([]);
  const [overtimeDetails, setOvertimeDetails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("employeeId");
  const [sortDirection, setSortDirection] = useState("asc");
  const [publicHolidays, setPublicHolidays] = useState([]);

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

  useEffect(() => {
    if (processedData.length > 0) {
      handleSort({ option: sortOption, direction: sortDirection });
    }
  }, [processedData, sortOption, sortDirection]);

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

    const leaveData = filterByDateRange(
      file2Data
        .map((row) => {
          const {
            date,
            length_hours,
            emp_firstname,
            emp_lastname,
            employee_id,
            name: leaveType,
          } = row;

          const formattedDate = moment(date, ["YYYY-MM-DD", "DD/MM/YYYY"]).format("YYYY-MM-DD");

          return {
            date: formattedDate,
            duration: parseFloat(length_hours || 0),
            leaveType,
            name: `${emp_firstname} ${emp_lastname}`,
            employeeId: employee_id,
          };
        })
        .filter((entry) => entry.duration > 0)
    );

    const leaveMap = leaveData.reduce((map, leave) => {
      const key = `${leave.employeeId}-${leave.date}`;
      map[key] = leave;
      return map;
    }, {});

    const progressData = filterByDateRange(
      file1Data
        .map((row) => {
          const { Date, Duration, Firstname, Lastname, EmployeeID, ActivityName } = row;
          const date = moment(Date, ["YYYY-MM-DD", "DD/MM/YYYY"]).format("YYYY-MM-DD");
          return {
            date,
            duration: parseFloat(Duration || 0),
            name: `${Firstname} ${Lastname}`,
            employeeId: EmployeeID,
            activityName: ActivityName,
          };
        })
        .filter((entry) => {
          const key = `${entry.employeeId}-${entry.date}`;
          return !leaveMap[key];
        })
    );

    const combinedData = [...progressData, ...leaveData];

    const aggregatedData = combinedData.reduce((acc, row) => {
      const { date, duration, name, employeeId, leaveType, activityName } = row;
      const isWeekend = moment(date).isoWeekday() >= 6;
      const isHoliday = publicHolidays.includes(date);

      const key = `${employeeId}-${name}`;

      if (!acc[key]) {
        acc[key] = {
          name,
          employeeId,
          totalDuration: 0,
          totalMandays: 0.0,
          mandays: 0,
          overtime: 0,
          leaveUnpaid: 0,
          leaveIllness: 0,
          leavePaid: 0,
          unAssignedTime: 0,
          unAssignedCount: 0,
          trackedDates: new Set(),
          startDate: date,
          endDate: date,
        };
      }

      acc[key].startDate = moment.min(moment(acc[key].startDate), moment(date)).format("YYYY-MM-DD");
      acc[key].endDate = moment.max(moment(acc[key].endDate), moment(date)).format("YYYY-MM-DD");

      acc[key].totalDuration += duration;

      if (activityName === "Un-assigned Time") {
        acc[key].unAssignedTime += duration / 8;
        acc[key].totalMandays -= duration / 8;
        acc[key].unAssignedCount += 1;
      } else if (leaveType === "Leave (UNPAID)") {
        acc[key].leaveUnpaid += duration / 8;
        acc[key].totalMandays += 1 - duration / 8;
      } else if (leaveType === "Illness") {
        acc[key].leaveIllness += duration / 8;
        acc[key].totalMandays += 1 - duration / 8;
      } else if (leaveType) {
        acc[key].leavePaid += 1;
        acc[key].totalMandays += 1;
      } else if (!isHoliday && !isWeekend) {
        if (!acc[key].trackedDates.has(date)) {
          acc[key].totalMandays += 1;
          acc[key].trackedDates.add(date);
        }
      } else {
        acc[key].overtime += duration / 8;
      }

      return acc;
    }, {});

    Object.values(aggregatedData).forEach((entry) => {
      entry.mandays = entry.totalMandays;
      delete entry.trackedDates;
    });

    const finalData = Object.values(aggregatedData);

    const dailyDetailsData = finalData.map((entry) => {
      const start = moment(startDate);
      const end = moment(endDate);
      const daily = {};

      while (start.isSameOrBefore(end)) {
        const day = start.format("YYYY-MM-DD");
        daily[day] = 0;
        start.add(1, "day");
      }

      combinedData.forEach((row) => {
        if (row.employeeId === entry.employeeId) {
          daily[row.date] = (daily[row.date] || 0) + row.duration;
        }
      });

      return {
        name: entry.name,
        employeeId: entry.employeeId,
        daily,
        totalDuration: entry.totalDuration,
      };
    });

    const overtimeDetailsData = finalData.map((entry) => {
      const start = moment(startDate);
      const end = moment(endDate);
      const overtime = {};

      while (start.isSameOrBefore(end)) {
        const day = start.format("YYYY-MM-DD");
        const isWeekend = start.isoWeekday() >= 6;
        const isHoliday = publicHolidays.includes(day);
        overtime[day] = 0;

        if (isWeekend || isHoliday) {
          combinedData.forEach((row) => {
            if (row.employeeId === entry.employeeId && row.date === day) {
              overtime[day] = ((overtime[day] || 0) + row.duration / 8); // Convert hours to mandays
            }
          });
        }

        start.add(1, "day");
      }

      return {
        name: entry.name,
        employeeId: entry.employeeId,
        overtime,
        totalOvertime: entry.overtime, // Already in mandays
      };
    });

    setProcessedData(finalData);
    setDailyDetails(dailyDetailsData);
    setOvertimeDetails(overtimeDetailsData);
    setIsLoading(false);
  };

  const handleSearch = (e) => {
    const searchValue = e.target.value.toLowerCase();
    setSearchTerm(searchValue);

    const filteredData = processedData.filter((item) =>
      item.name.toLowerCase().includes(searchValue)
    );
    setDisplayData(filteredData);
  };

  const handleSort = ({ option, direction }) => {
    const sortedData = [...processedData].sort((a, b) => {
      if (option === "name") {
        return direction === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      } else if (option === "mandays") {
        return direction === "asc" ? a.mandays - b.mandays : b.mandays - a.mandays;
      } else if (option === "duration") {
        return direction === "asc"
          ? a.totalDuration - b.totalDuration
          : b.totalDuration - a.totalDuration;
      } else if (option === "employeeId") {
        return direction === "asc"
          ? a.employeeId.localeCompare(b.employeeId)
          : b.employeeId.localeCompare(a.employeeId);
      }
      return 0;
    });

    setDisplayData(sortedData);
  };

  const exportToExcel = () => {
    const aggregatedSheet = processedData.map((item, index) => ({
      No: index + 1,
      Name: item.name,
      EmployeeID: item.employeeId,
      "Start Date": item.startDate,
      "End Date": item.endDate,
      "Total Duration": item.totalDuration.toFixed(2),
      Mandays: item.mandays.toFixed(2),
      Overtime: item.overtime.toFixed(2),
      "Leave (Paid)": item.leavePaid.toFixed(2),
      "Leave (Illness)": item.leaveIllness.toFixed(2),
      "Un-assigned": item.unAssignedTime.toFixed(2),
      "Leave (Unpaid)": item.leaveUnpaid.toFixed(2),
    }));
  
    const dailyDetailsSheet = dailyDetails.map((item) => {
      const { daily, ...rest } = item;
      const dailyColumns = Object.keys(daily).reduce((acc, day) => {
        acc[day] = daily[day].toFixed(2);
        return acc;
      }, {});
  
      return { ...rest, ...dailyColumns };
    });
  
    const overtimeDetailsSheet = overtimeDetails.map((item) => {
      const { overtime, ...rest } = item;
      const filteredOvertimeColumns = Object.keys(overtime).reduce((acc, day) => {
        if (overtime[day] > 0) {
          acc[day] = overtime[day].toFixed(2); // Only include dates with overtime
        }
        return acc;
      }, {});
  
      return { ...rest, ...filteredOvertimeColumns };
    });
  
    // Generate the Leave Details Sheet
    const leaveDetailsSheet = file2Data
      .map((row) => {
        const {
          date,
          length_hours,
          emp_firstname,
          emp_lastname,
          employee_id,
          name: leaveType,
        } = row;
  
        const formattedDate = moment(date, ["YYYY-MM-DD", "DD/MM/YYYY"]).format("YYYY-MM-DD");
        return {
          Date: formattedDate,
          "Employee Name": `${emp_firstname} ${emp_lastname}`,
          "Employee ID": employee_id,
          "Leave Type": leaveType,
          "Duration of Leave": parseFloat(length_hours || 0).toFixed(2),
        };
      })
      .filter((row) => row["Duration of Leave"] > 0); // Exclude leaves with 0 duration
  
    const wb = XLSX.utils.book_new();
    const aggregatedWs = XLSX.utils.json_to_sheet(aggregatedSheet);
    const dailyDetailsWs = XLSX.utils.json_to_sheet(dailyDetailsSheet);
    const overtimeDetailsWs = XLSX.utils.json_to_sheet(overtimeDetailsSheet);
    const leaveDetailsWs = XLSX.utils.json_to_sheet(leaveDetailsSheet);
  
    XLSX.utils.book_append_sheet(wb, aggregatedWs, "Aggregated Data");
    XLSX.utils.book_append_sheet(wb, dailyDetailsWs, "Daily Details");
    XLSX.utils.book_append_sheet(wb, overtimeDetailsWs, "Overtime Details");
    XLSX.utils.book_append_sheet(wb, leaveDetailsWs, "Leave Details");
  
    XLSX.writeFile(wb, `OrangeData_${startDate}_to_${endDate}.xlsx`);
  };  

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center py-10">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        Upload and Process Data
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
          <div className="flex justify-between items-center mb-4">
            <div>
              <label className="font-medium text-gray-700">Search by Name:</label>
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearch}
                placeholder="Search name..."
                className="ml-2 p-2 border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="font-medium text-gray-700">Sort By:</label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="ml-2 p-2 border border-gray-300 rounded"
              >
                <option value="name">Name</option>
                <option value="mandays">Mandays</option>
                <option value="duration">Duration</option>
                <option value="employeeId">Employee ID</option>
              </select>
              <button
                onClick={() =>
                  setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
                }
                className="ml-2 p-2 bg-gray-200 border border-gray-300 rounded"
              >
                {sortDirection === "asc" ? "Asc" : "Desc"}
              </button>
            </div>
            <button
              onClick={exportToExcel}
              className="p-2 bg-green-500 text-white rounded shadow-md"
            >
              Export to Excel
            </button>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Processed Data</h2>
          <table className="table-auto w-full whitespace-nowrap border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="border border-gray-300 p-2">No.</th>
                <th className="border border-gray-300 p-2">Name</th>
                <th className="border border-gray-300 p-2">EmployeeID</th>
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
              {displayData.map((item, index) => (
                <tr
                  key={index}
                  className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                >
                  <td className="border border-gray-300 p-2">{index + 1}</td>
                  <td className="border border-gray-300 p-2">{item.name || "N/A"}</td>
                  <td className="border border-gray-300 p-2">{item.employeeId || "N/A"}</td>
                  <td className="border border-gray-300 p-2">{item.startDate || "N/A"}</td>
                  <td className="border border-gray-300 p-2">{item.endDate || "N/A"}</td>
                  <td className="border border-gray-300 p-2">
                    {(item.totalDuration || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {(item.mandays || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {(item.overtime || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {(item.leavePaid || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {(item.leaveIllness || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {(item.unAssignedTime || 0).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {(item.leaveUnpaid || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UploadPage_RawOrange;