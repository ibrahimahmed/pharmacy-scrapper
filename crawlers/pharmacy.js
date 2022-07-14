const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const getReadableTimestamp = require("../utils/get-readable-timestamp");

const url2 = "https://www.healthdirect.gov.au/";
const rootUrl = "https://www.healthdirect.gov.au";
const filePath1 = "../files/pharmacy/places.json";
const filePath2 = "../files/pharmacy/visited-places.json";

const scrap = async (conObj) => {
  try {
    // load json
    let data = fs.readFileSync(path.join(__dirname, filePath1));
    // console.log("Data:", data.length);
    if (data.length === 2) {
      // if file has just square brackets
      // read data from visited file and empty it
      const visitedPlacesBuffer = fs.readFileSync(
        path.join(__dirname, filePath2)
      );
      fs.truncateSync(path.join(__dirname, filePath2), 0);
      // insert all that data inside places file
      fs.writeFileSync(
        path.join(__dirname, filePath1),
        visitedPlacesBuffer.toString()
      );
      data = fs.readFileSync(path.join(__dirname, filePath1));
    }
    let jsonData = data.toString();
    let postCodeData = JSON.parse(jsonData);

    // launch browser instance and create a new page(tab) instance
    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: null,
    });
    const page = await browser.newPage();
    // await page.waitForNavigation({ waitUntil: 'load' });
    let content;
    let $;
    // iterate over the post code data to scrap for each place
    // since we need to scrap 165 places per day so replace length with 165
    for (let i = 0; i < 51; i++) {
      console.log("PostCodeData:", postCodeData.length);
      // perform necessary automation
      if (i > 0) {
        data = fs.readFileSync(path.join(__dirname, filePath1));
        jsonData = data.toString();
        postCodeData = JSON.parse(jsonData);
      }
      // fill search form refactoring
      await page.goto(url2, { waitUntil: "load", timeout: 0 });
      console.log("WaitFor 1...");
      await page.waitForSelector(
        ".homepage_content-tools-tabs-list > div:nth-child(2)",
        { timeout: 5000 }
      );
      await page.click(".homepage_content-tools-tabs-list > div:nth-child(2)");
      console.log("WaitFor 2...");
      await page.waitForSelector(
        ".hsf-form_services-cols > label > input[data-service-name='Pharmacy']",
        { timeout: 5000 }
      );
      await page.click(
        ".hsf-form_services-cols > label > input[data-service-name='Pharmacy']"
      );
      // fill search form refactoring ends
      console.log("Check iteration:", postCodeData, postCodeData[0]);
      await page.type(".hsf-form_location-input-group-txt", postCodeData[0]);
      console.log("Current Place:", postCodeData[0]);
      console.log("WaitFor 3...");
      await page.waitForSelector(
        ".hsf-form_location-input-group-auto-suggest",
        { timeout: 5000 }
      );
      try {
        await page.waitForSelector(
          ".hsf-form_location-input-group-auto-suggest > li",
          { timeout: 3000 }
        );
      } catch (err) {
        console.log("Error:", err.message);
      }
      const suggestionsList = await page.$(
        ".hsf-form_location-input-group-auto-suggest > li"
      );
      // content = await page.content();
      // await page.waitForTimeout(3000);
      const suggestionsText = await page.$$eval(
        ".hsf-form_location-input-group-auto-suggest > li",
        (elems) => elems.map((elem) => elem.textContent)
      );
      console.log("Suggestion List:", suggestionsText);
      // add log for the current place
      fs.appendFileSync("pharmacies-log.txt", `\n${getReadableTimestamp()} - Logging "${postCodeData[0]}"`);
      if (suggestionsList && suggestionsText.length === 1) {
        console.log("Suggesions Length inside if:", suggestionsText.length);
        await page.click(
          ".hsf-form_location-input-group-auto-suggest > li:nth-child(1)"
        );
        console.log("WaitFor 4...");
        await page.waitForTimeout(3000);
        await page.click(
          "body > main > section > div > div > section.homepage_content-tools-panels-service.veyron-tool-hsf > section > form > fieldset.hsf-form_location.veyron-hsf-panel-location > div > button"
        );
        await page.waitForNavigation({
          waitUntil: "load",
          timeout: 0,
        });
        console.log("WaitFor 5...");
        try {
          await page.waitForSelector(
          ".hsf-search_results-item-tiles > .veyron-hsf-page > a",
          { timeout: 5000 }
        );
        } catch(err) {
          console.log("Page link element could not be loaded! Remove current place from the file.");
          fs.writeFileSync(
            path.join(__dirname, filePath1),
            JSON.stringify(postCodeData.slice(i + 1, postCodeData.length))
          );
          continue;
        }
        // get the required pharmacies' nodes and iterate over them
        content = await page.content();
        $ = cheerio.load(content);
        let pharmacyRows = $(
          ".hsf-search_results-item-tiles > .veyron-hsf-page > a"
        );
        for (let row of pharmacyRows) {
          // pull out the name and phone from the current row
          let name = $(row)
            .find(".hsf-search_results-item-tiles-tile-heading")
            .text()
            .trim();
          let phone = $(row)
            .find(".hsf-search_results-item-tiles-tile-phone")
            .text()
            .trim();
          // get the parent page link for the current row
          let parentPageLink = rootUrl + $(row).attr("href");
          // create a new page instance for that link
          let page2 = await browser.newPage();
          await page2.goto(parentPageLink, { waitUntil: "load", timeout: 0 });
          // pull out the contact info and address
          let content2 = await page2.content();
          let $new = cheerio.load(content2);
          // pull out the address and email
          let address = $new(".veyron-hsf-full-address").text().trim();
     
          const faxScriptData = $new("script[type='application/ld+json']")[0].children[0].data;
          const fax = JSON.parse(faxScriptData).contactPoint.fax.split(" ").join('');
          console.log("Fax number: ", fax);
          let contactInfo = $new(
            ".hsf-service_details-data-info-list:not(.hidden) .veyron-hsf-contact-details[data-phone] .hsf-service_details-data-contact + ul > li"
          );
          console.log("Contact Info length;", contactInfo.length);
          let emailOrWebsite = $new(
            ".hsf-service_details-data-info-list:not(.hidden) .veyron-hsf-contact-details[data-phone] .hsf-service_details-data-contact + ul > li:nth-child(2)"
          )
            .text()
            .trim();
          let email;
          if (contactInfo.length === 2) {
            console.log("Contact info length 2");
            const isEmail = emailOrWebsite.includes("E:");
            if (isEmail) {
              console.log(
                "It is email:",
                emailOrWebsite,
                emailOrWebsite.split("\n")[2].trim()
              );
              email = emailOrWebsite.split("\n")[2].trim();
            }
          }
          if (contactInfo.length === 3) {
            console.log("Inside contact info length 3!");
            console.log("Name:", name);
            console.log(
              "Testing:",
              $new(
                ".hsf-service_details-data-info-list:not(.hidden) .veyron-hsf-contact-details[data-phone] .hsf-service_details-data-contact + ul > li:nth-child(2) > a"
              )
                .text()
                .trim()
            );
            email = $new(
              ".hsf-service_details-data-info-list:not(.hidden) .veyron-hsf-contact-details[data-phone] .hsf-service_details-data-contact + ul > li:nth-child(2) > a"
            )
              .text()
              .trim();
          }
          // console.log(email, address);
          name = name ? name.split("\n")[0] : "Not available";
          phone = phone
            ? phone.split("Ph: ")[1].split(" ").join("")
            : "Not available";
          email = email ? email : "Not available";
          address = address ? address.split("\n")[1].trim() : "Not available";

          let url = page2.url();
          let id = uuidv4();
          let date = new Date();

          // insert data in pharmacies table
          conObj.query(
            `SELECT COUNT(*) FROM Pharmacies WHERE phone=${conObj.escape(phone)}`,
            (error, results, fields) => {
              if (error) throw error;
              console.log("Already existing records:", results[0]["COUNT(*)"]);
              if (results[0]["COUNT(*)"] === 0) {
                // perform upsert based on phone column
                conObj.query(
                  `INSERT INTO Pharmacies (id, name, address, phone, fax, email, createdAt, updatedAt, url) VALUES (${conObj.escape(
                    id
                  )}, ${conObj.escape(name)}, ${conObj.escape(
                    address
                  )}, ${conObj.escape(phone)}, ${conObj.escape(fax)}, ${conObj.escape(
                    email
                  )}, ${conObj.escape(date)}, ${conObj.escape(
                    date
                  )}, ${conObj.escape(url)})`,
                  (error, results, fields) => {
                    if (error) throw error;
                    console.log("Data inserted!");
                    fs.appendFileSync(
                      "pharmacies-log.txt",
                      `\n${getReadableTimestamp()} - Data inserted for ${name}.`
                    );
                  }
                );
              } else {
                conObj.query(
                    `UPDATE Pharmacies 
                      SET name = ${conObj.escape(name)}, address = ${conObj.escape(address)}, phone = ${conObj.escape(phone)}, fax = ${conObj.escape(fax)}, email = ${conObj.escape(email)}, updatedAt = ${conObj.escape(date)}
                      WHERE phone = ${conObj.escape(phone)}`,
                  (error, results, fields) => {
                    if (error) throw error;
                    console.log("Data updated!");
                    fs.appendFileSync(
                      "pharmacies-log.txt",
                      `\n${getReadableTimestamp()} - Data updated for ${name}.`
                    );
                  }
                );
              }
            }
          );

          // destroy that new page instance
          await page2.close();
        }
      } else if (suggestionsText.length > 1) {
        console.log(
          "Suggestions Length inside else if:",
          suggestionsText.length
        );
        // iterate over suggestions text and open for each one
        for (let k = 1; k <= suggestionsText.length; k++) {
          console.log("Inside suggestions loop!");
          console.log("WaitFor 8...");
          await page.waitForSelector(
            `.hsf-form_location-input-group-auto-suggest > li:nth-child(${k})`,
            { timeout: 5000 }
          );
          await page.click(
            `.hsf-form_location-input-group-auto-suggest > li:nth-child(${k})`
          );
          console.log("WaitFor 9...");
          await page.waitForTimeout(3000);
          await page.click(
            "body > main > section > div > div > section.homepage_content-tools-panels-service.veyron-tool-hsf > section > form > fieldset.hsf-form_location.veyron-hsf-panel-location > div > button"
          );
   
          await page.waitForTimeout(5000);
          console.log("WaitFor 10...");
          const dataItems = await page.$(
            ".hsf-search_results-item-tiles > .veyron-hsf-page > a"
          );
          console.log("Data Items: ", dataItems);
          if (dataItems) {
            try {
              await page.waitForSelector(
                ".hsf-search_results-item-tiles > .veyron-hsf-page > a",
                { timeout: 5000 }
              );
            } catch(err) {
              console.log("Page link element could not be loaded! Remove current place from the file.");
              fs.writeFileSync(
                path.join(__dirname, filePath1),
                JSON.stringify(postCodeData.slice(i + 1, postCodeData.length))
              );
              continue;
            }
            console.log("WaitFor 11...");
            await page.waitForTimeout(5000);
            // get the required pharmacies' nodes and iterate over them
            content = await page.content();
            $ = cheerio.load(content);
            let pharmacyRows = $(
              ".hsf-search_results-item-tiles > .veyron-hsf-page > a"
            );
            for (let row of pharmacyRows) {
              // pull out the name and phone from the current row
              let name = $(row)
                .find(".hsf-search_results-item-tiles-tile-heading")
                .text()
                .trim();
              let phone = $(row)
                .find(".hsf-search_results-item-tiles-tile-phone")
                .text()
                .trim();
              // get the parent page link for the current row
              let parentPageLink = rootUrl + $(row).attr("href");
              // create a new page instance for that link
              let page2 = await browser.newPage();
              await page2.goto(parentPageLink, {
                waitUntil: "load",
                timeout: 0,
              });
              // pull out the contact info and address
              let content2 = await page2.content();
              let $new = cheerio.load(content2);
              // pull out the address and email
              let address = $new(".veyron-hsf-full-address").text().trim();
       
              const faxScriptData = $new("script[type='application/ld+json']")[0].children[0].data;
              const fax = JSON.parse(faxScriptData).contactPoint.fax.split(" ").join('');
              console.log("Fax number: ", fax);
              let contactInfo = $new(
                ".hsf-service_details-data-info-list:not(.hidden) .veyron-hsf-contact-details[data-phone] .hsf-service_details-data-contact + ul > li"
              );
              console.log("Contact Info length;", contactInfo.length);
              let emailOrWebsite = $new(
                ".hsf-service_details-data-info-list:not(.hidden) .veyron-hsf-contact-details[data-phone] .hsf-service_details-data-contact + ul > li:nth-child(2)"
              )
                .text()
                .trim();
              let email;
              if (contactInfo.length === 2) {
                console.log("Contact info length 2");
                const isEmail = emailOrWebsite.includes("E:");
                if (isEmail) {
                  console.log(
                    "It is email:",
                    emailOrWebsite,
                    emailOrWebsite.split("\n")[2].trim()
                  );
                  email = emailOrWebsite.split("\n")[2].trim();
                }
              }
              if (contactInfo.length === 3) {
                console.log("Inside contact info length 3!");
                console.log("Name:", name);
                console.log(
                  "Testing:",
                  $new(
                    ".hsf-service_details-data-info-list:not(.hidden) .veyron-hsf-contact-details[data-phone] .hsf-service_details-data-contact + ul > li:nth-child(2) > a"
                  )
                    .text()
                    .trim()
                );
                email = $new(
                  ".hsf-service_details-data-info-list:not(.hidden) .veyron-hsf-contact-details[data-phone] .hsf-service_details-data-contact + ul > li:nth-child(2) > a"
                )
                  .text()
                  .trim();
              }
              // console.log(email, address);
              name = name ? name.split("\n")[0] : "Not available";
              phone = phone
                ? phone.split("Ph: ")[1].split(" ").join("")
                : "Not available";
              email = email ? email : "Not available";
              address = address
                ? address.split("\n")[1].trim()
                : "Not available";

              let url = page2.url();
              let id = uuidv4();
              let date = new Date();

          // insert data in pharmacies table
          conObj.query(
            `SELECT COUNT(*) FROM Pharmacies WHERE phone=${conObj.escape(phone)}`,
            (error, results, fields) => {
              if (error) throw error;
              console.log("Already existing records:", results[0]["COUNT(*)"]);
              if (results[0]["COUNT(*)"] === 0) {
                // perform upsert based on phone column
                conObj.query(
                  `INSERT INTO Pharmacies (id, name, address, phone, fax, email, createdAt, updatedAt, url) VALUES (${conObj.escape(
                    id
                  )}, ${conObj.escape(name)}, ${conObj.escape(
                    address
                  )}, ${conObj.escape(phone)}, ${conObj.escape(fax)}, ${conObj.escape(
                    email
                  )}, ${conObj.escape(date)}, ${conObj.escape(
                    date
                  )}, ${conObj.escape(url)})`,
                  (error, results, fields) => {
                    if (error) throw error;
                    console.log("Data created!");
                    fs.appendFileSync(
                      "pharmacies-log.txt",
                      `\n${getReadableTimestamp()} - Data created for ${name}.`
                    );
                  }
                );
              } else {
               conObj.query(
                    `UPDATE Pharmacies 
                      SET name = ${conObj.escape(name)}, address = ${conObj.escape(address)}, phone = ${conObj.escape(phone)}, fax = ${conObj.escape(fax)}, email = ${conObj.escape(email)}, updatedAt = ${conObj.escape(date)}
                      WHERE phone = ${conObj.escape(phone)}`,
                  (error, results, fields) => {
                    if (error) throw error;
                    console.log("Data updated!");
                    fs.appendFileSync(
                      "pharmacies-log.txt",
                      `\n${getReadableTimestamp()} - Data updated for ${name}.`
                    );
                  }
                );
              }
            }
          );

              // destroy that new page instance
              await page2.close();
            }
          } else {
            fs.appendFileSync(
              "pharmacies-log.txt",
              `\n${getReadableTimestamp()} = Data doesn't exist for ${suggestionsText[k]}!`
            );
            await page.goBack();
            await page.goto(url2, { waitUntil: "load", timeout: 0 });
            await page.waitForSelector(
              ".homepage_content-tools-tabs-list > div:nth-child(2)",
              { timeout: 5000 }
            );
            await page.click(
              ".homepage_content-tools-tabs-list > div:nth-child(2)"
            );
            console.log("WaitFor 13...");
            await page.waitForSelector(
              ".hsf-form_services-cols > label > input[data-service-name='Pharmacy']",
              { timeout: 5000 }
            );
            await page.click(
              ".hsf-form_services-cols > label > input[data-service-name='Pharmacy']"
            );
            await page.type(
              ".hsf-form_location-input-group-txt",
              postCodeData[0]
            );
            await page.waitForSelector(
              ".hsf-form_location-input-group-auto-suggest"
            );
            continue;
          }

          await page.goBack();
          // fill search form refactoring
          await page.goto(url2, { waitUntil: "load", timeout: 0 });
          console.log("WaitFor 12...");
          await page.waitForSelector(
            ".homepage_content-tools-tabs-list > div:nth-child(2)",
            { timeout: 5000 }
          );
          await page.click(
            ".homepage_content-tools-tabs-list > div:nth-child(2)"
          );
          console.log("WaitFor 13...");
          await page.waitForSelector(
            ".hsf-form_services-cols > label > input[data-service-name='Pharmacy']",
            { timeout: 5000 }
          );
          await page.click(
            ".hsf-form_services-cols > label > input[data-service-name='Pharmacy']"
          );
          // fill search form refactoring
          if (i !== suggestionsText.length) {
            await page.type(
              ".hsf-form_location-input-group-txt",
              postCodeData[0]
            );
            await page.waitForSelector(
              ".hsf-form_location-input-group-auto-suggest"
            );
          }
          // console.log("Current Place:", postCodeData[i]);
        }
      } else if (!suggestionsList) {
        console.log(`No record found for ${postCodeData[0]}.`);
        fs.appendFileSync(
          "pharmacies-log.txt",
          `\n${getReadableTimestamp()} - No record found for ${postCodeData[0]}.`
        );
      }

      // move data from places to visited places
      console.log(postCodeData.slice(i, postCodeData.length));
      console.log("Remove :", postCodeData[0]);
      fs.writeFileSync(
        path.join(__dirname, filePath1),
        JSON.stringify(postCodeData.slice(i + 1, postCodeData.length))
      );
      // check if the visited file is empty
      // if empty then enter a new json array with first place in the file
      let visitedData = fs.readFileSync(path.join(__dirname, filePath2));
      console.log("Visited data:", visitedData, visitedData.length);

      if (!visitedData.length) {
        fs.writeFileSync(
          path.join(__dirname, filePath2),
          JSON.stringify([postCodeData[0]])
        );
      } else {
        let visitedJsonData = visitedData.toString();
        let visitedPlaces = JSON.parse(visitedJsonData);
        const newVisitedPlaces = [...visitedPlaces, postCodeData[0]];
        fs.writeFileSync(
          path.join(__dirname, filePath2),
          JSON.stringify(newVisitedPlaces)
        );
      }
    }
    conObj.destroy();
    await browser.close();
    // console.log("Data:", data, data.length);
  } catch (err) {
    console.log("Error:", err);
    console.log("Error Message:", err.message);
    fs.appendFileSync("pharmacies-log.txt", `\n${getReadableTimestamp()} - ${err.message}`);
  }
};

module.exports = scrap;
