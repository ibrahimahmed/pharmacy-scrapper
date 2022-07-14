const dotenv = require("dotenv");
const mysql = require("mysql");
const scrapPharmacies = require("./crawlers/pharmacy");

dotenv.config();

const conObj = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  multipleStatements: true,
});

conObj.connect((err) => {
  if (err) {
    console.log("DB connection error:", err);
    return;
  }
  console.log("DB connection established!");

  // scrap pharmacies data
  scrapPharmacies(conObj);
});
