const axios = require("axios");
const fs = require("fs");
const path = require("path");

const placesJsonUrl = "https://raw.githubusercontent.com/Elkfox/Australian-Postcode-Data/master/au_postcodes.json";
const pharmacyPlacesPath = "../files/pharmacy/places.json";
const clinicPlacesPath = "../files/clinic/places.json";

/**
 * write places names to the places.json file
 * @param {string} url 
 */

const getPlacesForPharmacies = async (url) => {
    const { data } = await axios.get(url);
    console.log("Data:", data);
    const places = data.map(place => place.place_name);
    const uniquePlaces = [];
    for(let place of places) {
        if(uniquePlaces.length !== 0) {
            const result = uniquePlaces.find(uniquePlace => uniquePlace === place);
            console.log("Result:", result);
            if(!result) {
                console.log("Place:", place);
                uniquePlaces.push(place);
            }
        } else {
            uniquePlaces.push(place);
        }
    }
    fs.writeFileSync(path.join(__dirname, pharmacyPlacesPath), JSON.stringify(uniquePlaces));
}


/**
 * write places names(city), state codes(region), postcodes(zipcode),
 * @param {string} url 
 */

const getPlacesForClinics = async (url) => {
    const { data } = await axios.get(url);
    console.log("Data:", data);
    const places = data.map(place => ({
        city: place.place_name,
        region: place.state_code,
        zipcode: place.postcode
    }));
    const uniquePlaces = [];
    for(let place of places) {
        if(uniquePlaces.length !== 0) {
            const result = uniquePlaces.find(uniquePlace => uniquePlace.city === place.city);
            console.log("Result:", result);
            if(!result) {
                console.log("Place:", place);
                uniquePlaces.push(place);
            }
        } else {
            uniquePlaces.push(place);
        }
    }
    fs.writeFileSync(path.join(__dirname, clinicPlacesPath), JSON.stringify(uniquePlaces));
}


getPlacesForClinics(placesJsonUrl);
// getPlacesForPharmacies(placesJsonUrl);