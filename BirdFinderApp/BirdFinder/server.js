// app.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bcrypt = require('bcrypt'); //encrypt the password
const helper = require('./helper'); 
const db = new sqlite3.Database('./database.db');

const API_KEY = 'phljlqm7ko05';
const http = require('http');

const app = express(); // Create an Express app
const PORT = process.env.PORT || 3000;

app.set('view engine', 'hbs'); // Set the view engine to use Handlebars

// Middleware to parse incoming request bodies
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

// Middleware to check if user is logged in (authenticated)
//requireLogin is used in routes that require the user to be logged in
const requireLogin = (req, res, next) => {
 //if the user is not logged in, redirect them to the home page
  if (!req.session.userId) {
    res.redirect('/');
  } else {
    //if the user is logged in, proceed to the next middleware
    next();
  }
};

//**Home page routes**
app.get('/', (req, res) => {
    res.render('home');
});

app.post('/' , (req, res) => {
    const action = req.body.action; 
    
    // Redirect users based on the action they performed
    if (action === 'login') {
        res.redirect('/login'); 
    } else if (action === 'register') {
        res.redirect('/register'); 
    } else {
        res.redirect('/');
    }
});


//**Login page routes**
app.get('/login', (req, res) => {
    res.render('login');

});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await getUserByUsername(username);
  //check if the user exits and the password is correct
  if (user && bcrypt.compareSync(password, user.password)) {
     
    req.session.userId = user.id;
    res.redirect('/dashboard'); //redirect to dashboard if user is authenticated
  } else {
    res.redirect('/login');
  }
});

//**Logout page routes**
app.post('/logout', (req, res) => {
    //logout user
    req.session.userId = null; //clear the session
    res.redirect('/');
}); 

//**Register page routes**
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10); //use bcrypt to hash the password so that it cannot be read by anyone who has access to the database

  //create a new user using the createUser function
  await createUser(username, hashedPassword);

  //then have them login after they have registered
  res.redirect('/login');
});



//**Dashboard page routes**
app.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard');
});


app.post('/dashboard', requireLogin, async (req, res) => {
   try {
        const { region } = req.body; // Get the region from the form submission
    
        res.redirect('/searchBird?region=' + region); // Redirect to the bird sightings page with the region as a query parameter
    }
    catch (error) {
        console.error('Error fetching bird sightings:', error);
        res.status(500).send('Internal Server Error');
    }

});

//**Search Birds page routes **
app.post('/searchBird', requireLogin, async (req, res) => {
  res.render('birdSightings');
});

app.get('/searchBird', requireLogin, async (req, res) => {
 try {
  const region = req.query.region; // Get the region from the query parameter
  const sightings = await helper.getBirdSearches(region); // Fetch bird sightings for the region using the helper function which makes an  ebird.org API request
  res.render('birdSightings', { sightings, region });

 } catch (error) {
  console.error('Error fetching bird sightings:', error);
  res.status(500).send('Internal Server Error');
 }

});

//**Bird Details page routes**
app.get('/birdDetails', requireLogin, async (req, res) => {
  try {
      const { region, speciesCode } = req.query;
      const birdDetails = await helper.getBirdDetails(region, speciesCode); // Fetch bird details using the helper function which makes an ebird.org API request
      res.render('birdDetails', { birdDetails, region, speciesCode });
      
  } catch (error) {
      console.error('Error fetching bird details:', error);
      res.status(500).send('Internal Server Error');
  }
});

app.post('/birdDetails', requireLogin, async (req, res) => {
  try {
      const { region, speciesCode, commonName } = req.body;
  
      const userId = req.session.userId; // Get the user ID from the session
      
      //add the bird to the user's bird list
      db.run('INSERT INTO user_bird_list (user_id, species_name) VALUES (?, ?)', [userId, commonName], (err) => {
          if (err) {
              console.error('Error adding bird to list:', err);
              res.status(500).send('Internal Server Error');
          } else {
              res.status(200).send('Bird added to list');
          }
      })
  } catch (error) {
      console.error('Error fetching bird details:', error);
      res.status(500).send('Internal Server Error');
  }
});

//**User Bird List page routes**
app.post('/birdList', requireLogin, async (req, res) => {
  try {
      const userId = req.session.userId; // Get the user ID from the session
      const birdIdToRemove = req.body.birdId;  // Get the bird ID to remove from the form submission

      // Remove the bird from the user's bird list
      db.run('DELETE FROM user_bird_list WHERE user_id = ? AND id = ?', [userId, birdIdToRemove], (err) => {
          if (err) {
              console.error('Error removing bird from list:', err);
              res.status(500).send('Internal Server Error');
          } else {
              // get the updated bird list after removing the previous bird
              db.all('SELECT * FROM user_bird_list WHERE user_id = ?', [userId], (err, rows) => {
                  if (err) {
                      console.error('Error fetching updated bird list:', err);
                      res.status(500).send('Internal Server Error');
                  } else {
                      res.render('birdList', { birds: rows }); // Render the bird list page with the updated bird list
                  }
              });
          }
      });
  } catch (error) {
      console.error('Error removing bird from list:', error);
      res.status(500).send('Internal Server Error');
  }
});

//**Users page route */
app.post('/users',  async (req, res) => {
    try {
           // Check if the logged-in user has admin role
           db.all ('SELECT role FROM users WHERE id = ?' , [req.session.userId], (err, rows) => {
                if (err) {
                     console.error('Error fetching user role:', err);
                     res.status(500).send('Internal Server Error');
                } else {
                     const userRole = rows[0].role;
                     if (userRole === 'admin') {
                          // If user is an admin, proceed to fetch users list
                          db.all('SELECT * FROM users', (err, rows) => {
                            if (err) {
                                 console.error('Error fetching users list:', err);
                                 res.status(500).send('Internal Server Error');
                            } else {
                                 res.render('users', { users: rows });
                            }
                          });
                     } else {
                          // If user is not an admin, send a 403 Forbidden response
                          res.status(403).send('Forbidden');
                     }
                }

           });

           
        
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Internal Server Error');
    }

});

//**Database Initialization **

db.serialize(() => {
  //create table to store users and their roles (only 1 admin currently)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('Users table created successfully');
    }
  });

  //create table to store each user's bird list
  db.run(`
    CREATE TABLE IF NOT EXISTS user_bird_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      species_name TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating user_bird_lists table:', err.message);
    } else {
      console.log('Bird lists table created successfully');
    }
  });
    //an admin user was inserted into the users table for testing purposes
    //var sqlString = "INSERT INTO users (username, password, role) VALUES (?, ?, ?)";
   // db.run(sqlString, ["admin", bcrypt.hashSync("admin", 10), "admin"]);
});

//function to create a new user
const createUser = async (username, password) => {
  let role = 'user'; //default role is user, admin role is set in the database initialization
  const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
  await db.run(query, [username, password, role]);
};

//function to get a user by their username
const getUserByUsername = async (username) => {
  const query = 'SELECT * FROM users WHERE username = ?';
  //return a promise that resolves with the user if found
  return new Promise((resolve, reject) => {
    //get the user from the database with the given username
    db.get(query, [username], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row); //resolve with the user
      }
    });
  });
};

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`To Test:`)
		
		console.log('http://localhost:3000/')
		console.log('http://localhost:3000')
		console.log('http://localhost:3000/login')
		console.log('http://localhost:3000/register')
    console.log('http://localhost:3000/dashboard')
    console.log('http://localhost:3000/searchBird?region=CA')
    console.log('http://localhost:3000/birdList')
    
});
