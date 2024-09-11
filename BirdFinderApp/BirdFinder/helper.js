const fetch = require('node-fetch');

const ebirdApiKey = 'phljlqm7ko05';


const getBirdSearches = async (region) => {
    //limit to 10 results
  //fetch bird sightings from ebird api
  const url = `https://api.ebird.org/v2/data/obs/${region}/recent?maxResults=20`;

  try {
    //fetch data from ebird api
    const response = await fetch(url, {
      headers: {
        'X-eBirdApiToken': ebirdApiKey
      }
    });
    //parse data to json
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching bird sightings:', error);
    return [];
  }
};


const getBirdDetails = async (region, speciesCode) => {
  //fetch bird details from ebird api
  const url = `https://api.ebird.org/v2/data/obs/${region}/recent/${speciesCode}`;

  try {
    //fetch data from ebird api
    const response = await fetch(url, {
      headers: {
        'X-eBirdApiToken': ebirdApiKey
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching bird details:', error);
    return {};
  }
};



module.exports = { getBirdSearches, getBirdDetails };
