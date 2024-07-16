const express = require('express');
const ejs = require("ejs");
const pg = require("pg");
const bcrypt = require("bcryptjs");
const bodyParser = require('body-parser'); // Declare bodyParser only once with const
const multer = require('multer');

const app = express();
const port = 3000;

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "cinemaBookingSystem",
    password: "root123",
    port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({extended: true}));


app.set('view engine', 'ejs');

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

const session = require("express-session");
const { register } = require('module');

app.use(
    session({
        secret: "1234",
        resave: false,
        saveUninitialized: false,
    })
);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/'); // Specify the directory where uploaded files will be stored
    },
    filename: function (req, file, cb) {
      // Generate unique filename by adding a timestamp to the original filename
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });

  const upload = multer({ storage: storage });

app.get('/', async(req, res) => {
    res.render("home");
})

app.get("/register.ejs",async(req, res) => {
    res.render("register")
})

// app.get('/map', (req, res) => {
//     res.render('map', { apiKey: 'X7-hmX_xgzVuVHHtPjdk9L3n767TZilxzECT4usOapM' });
//   });
app.get('/map', (req, res) => {
    res.render('map', { apiKey: 'oGZ1IlSE0NoRVBHafhxsE4a4vR2KplhmTqenlfmVSGM' });
  });
  



app.post("/register", async (req, res) => {
    console.log(req.body);
    const username = req.body.username;
    console.log('username: ', username);
    const email = req.body.email; // Fix: Access email field from req.body
    const password = req.body.password; // Fix: Access password field from req.body
    const confirmPassword = req.body.confirmPassword; // Fix: Correct variable name

    try {
        const existingUser = await db.query(
            "SELECT * FROM register WHERE username = $1 OR email = $2",
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            return res.send("Username or email already exists. Please choose a different one.");
        }

        const hash = await bcrypt.hash(password, 10);

        await db.query(
            "INSERT INTO register (username, email, password) VALUES ($1, $2, $3)",
            [username, email, hash]
        );

        res.redirect("/");
    } catch (error) {
        console.error("ERROR OCCURRED WHILE INSERTING INTO THE DATABASE: ", error);
        res.status(500).send("Internal server Error");
    }
});

app.get("/termsAndConditions.ejs",async(req, res) => {
    res.render("termsAndConditions.ejs")
})

app.get("/login.ejs",async(req, res) => {
    res.render("login")
})

app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        // Query the database to find the user with the provided username
        const result = await db.query('SELECT * FROM register WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            return res.send("Username not found");
        }

        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            // Passwords match, user is authenticated
            req.session.user = user; // Store user information in session
            // res.render("afterLoginHome.ejs"); // Render afterLoginHome.ejs
            const moviesData = await db.query('SELECT movie_name , image FROM movies')
            res.render('afterLoginHome',{moviesData:moviesData.rows})
        } else {
            // Incorrect password
            return res.send("Incorrect password");
        }
    } catch (error) {
        console.error("Error while querying database:", error);
        return res.status(500).send("Internal server error");
    }
});

app.get("/adminLogin.ejs",async(req, res) => {
    res.render("adminLogin")
})

app.post('/adminLogin', (req, res) => {
    const password = req.body.password;

    if (password === '12345') {
        req.session.adminLoggedIn = true; // Set a session variable to indicate admin is logged in
        return res.render('crudMenu'); // Redirect to the management page
    } else {
        // Incorrect password
        return res.send("Incorrect password");
    }
});

app.get('/manage.ejs', (req, res) => {
    res.render("manage.ejs")
});

app.get("/crudMenu.ejs", async(req, res) => {
    if (req.session.adminLoggedIn) {
        res.render('crudMenu'); // Render your management page (manage.ejs)
    } else {
        res.redirect('/adminLogin'); // If admin is not logged in, redirect to admin login page
    }
})

app.post('/manage.ejs', upload.single('movieImage'), async (req, res) => {
    const { movieName, theatreName, noSeats, seatsBooked } = req.body;
    const movieImage = req.file.filename; // Multer adds 'file' object to 'req'
  
    try {
      await db.query(
        'INSERT INTO movies (movie_name, theatre_name, no_seats, seats_booked, image) VALUES ($1, $2, $3, $4, $5)',
        [movieName, theatreName, noSeats, seatsBooked, movieImage]
      );
      
      res.redirect('/manage.ejs');
    } catch (error) {
      console.error("Error while inserting movie:", error);
      res.status(500).send("Internal server error");
    }
  });

app.get("/updateMovie.ejs",async(req, res) => {
    const movies = await db.query('SELECT movie_name FROM movies');
    res.render("updateMovie.ejs",{movies: movies.rows})
})

app.post("/updateMovie.ejs", async (req, res) => {
    const movieSelected = req.body.movie;
    try {
    const result = await db.query('SELECT * FROM movies WHERE movie_name = $1', [movieSelected]);

        if (result.rows.length === 0) {
            return res.send("Movie not found");
        }
        const movieDetails = result.rows[0];
        
        const theatreName = movieDetails.theatre_name;
        const noSeats = movieDetails.no_seats;
        const seatsBooked = movieDetails.seats_booked;
        res.render('editMovie',{movieSelected,theatreName,noSeats,seatsBooked});
    } catch (error) {
        console.error("Error while retrieving movie details:", error);
        res.status(500).send("Internal server error");
    }    
});

app.post("/updateMovieDetails", async (req, res) => {
    const { movieName, theatreName, noSeats, seatsBooked } = req.body;
    const movieSelected = req.body.movieName; // Assuming you also send the movie name in the request body

    try {
        // Update all movie details in the database
        await db.query(
            'UPDATE movies SET movie_name = $1, theatre_name = $2, no_seats = $3, seats_booked = $4 WHERE movie_name = $5',
            [movieName, theatreName, noSeats, seatsBooked, movieSelected]
        );

        // Redirect to the page where you want to go after updating the movie details
        res.redirect('/updateMovie.ejs'); // For example, redirect back to the edit movie page
    } catch (error) {
        console.error("Error occurred while updating movie details:", error);
        res.status(500).send("Internal server error");
    }
});



app.get("/deleteMovie.ejs",async(req, res) => {
    const movies = await db.query('SELECT movie_name FROM movies');
    res.render("deleteMovie.ejs",{movies: movies.rows})
})


app.post("/deleteMovie.ejs", async (req, res) => {
    const movieSelected = req.body.movie;
    
    try {
        // Delete the selected movie from the movies table
        await db.query('DELETE FROM movies WHERE movie_name = $1', [movieSelected]);

        // Redirect to the page where you want to go after deleting the movie
        res.redirect('/crudMenu.ejs'); // For example, redirect to the manage page
    } catch (error) {
        console.error("Error occurred while deleting movie:", error);
        res.status(500).send("Internal server error");
    }
});


app.get('/bookMovies.ejs', async (req, res) => {
    try {
        // Retrieve movies data from your database
        const movies = await db.query('SELECT movie_name FROM movies');
        
        // Retrieve theatres data from your database
        const theatres = await db.query('SELECT theatre_name FROM movies');

        const selectedMovie = req.query.movieSelected;

        // Render the bookMovies.ejs template and pass both movies and theatres data
        res.render('bookMovies', { movies: movies.rows, theatres: theatres.rows,selectedMovie: selectedMovie });
    } catch (error) {
        console.error("Error while retrieving movies and theatres data:", error);
        res.status(500).send("Internal server error");
    }
});

app.post("/bookMovies.ejs", async (req, res) => {
    const {show_date, show_time, no_seats, movie, theatre, } = req.body;
    var ticket_cost = req.body.ticket_cost;
    if(ticket_cost == "gandhi_class") {
        ticket_cost = 80*no_seats;
    } else if(ticket_cost == "second_class") {
        ticket_cost = 120*no_seats;
    } else{
        ticket_cost = 200*no_seats;
    }
    try {
        // Insert details into showDetails table
        await db.query(
            "INSERT INTO showdetails (show_date, show_time, no_seats, ticket_cost, movie, theatre) VALUES ($1, $2, $3,$4, $5, $6)",
            [show_date, show_time, no_seats, ticket_cost, movie, theatre]
        );
        
        await db.query(
            "UPDATE movies SET seats_booked = seats_booked + $1 WHERE theatre_name = $2",
            [no_seats, theatre]
        );

        const showDetails = await db.query('SELECT * FROM showdetails ORDER BY id DESC LIMIT 1');
        return res.render('bookingDetails', { showDetails: showDetails.rows[0] });

    } catch (error) {
        console.error("Error occurred while booking movie:", error);
        res.status(500).send("Internal server error");
    }
});



app.get("/paymentDetails.ejs", async(req, res) => {
    res.render("paymentDetails.ejs")
})

app.post("/paymentDetails.ejs",async(req,res)=>{
    const paymentMethod = req.body.paymentMethod;
    const bill = await db.query('SELECT * FROM showdetails ORDER BY id DESC LIMIT 1');
    if(paymentMethod == "upi") {
        res.render("upiPayment.ejs",{bill: bill.rows[0]});
    } else {
        res.render("cardPayment.ejs",{bill: bill.rows[0]});
    }
})

app.post("/upiPayment.ejs", async (req, res) => {
    const { phone_no, upi_id, userBooked } = req.body;

    try {
        // Retrieve the latest show details to get the number of seats
        const billResult = await db.query('SELECT * FROM showdetails ORDER BY id DESC LIMIT 1');
        
        if (billResult.rows.length === 0) {
            return res.status(400).send("No show details found");
        }

        const bill = billResult.rows[0]; // Get the first row of the result set
        
        // Insert details into the upiPayment table
        await db.query(
            "INSERT INTO upiPayment (userbooked, phone_no, upi_id, no_seats) VALUES ($1, $2, $3, $4)",
            [userBooked, phone_no, upi_id, bill.no_seats]
        );

        const paymentDetails = await db.query('SELECT * FROM upipayment ORDER BY id DESC LIMIT 1')
        const showDetails = await db.query('SELECT * FROM showdetails ORDER BY id DESC LIMIT 1');
        return res.render("paymentDoneUpi.ejs",{paymentDetails: paymentDetails.rows[0],showDetails:showDetails.rows[0]});
        
        

    } catch (error) {
        console.error("Error occurred while processing upi payment:", error);
        res.status(500).send("Internal server error");
    }
});

app.post("/cardPayment.ejs", async (req, res) => {
    const { userBooked, card_no, date, cvv, phone_no } = req.body;

    try {
        // Retrieve the latest show details to get the number of seats
        const billResult = await db.query('SELECT * FROM showdetails ORDER BY id DESC LIMIT 1');
        
        if (billResult.rows.length === 0) {
            return res.status(400).send("No show details found");
        }

        const bill = billResult.rows[0]; // Get the first row of the result set
        
        // Insert details into the upiPayment table
        await db.query(
            "INSERT INTO cardpayment (userbooked, card_no, expiry_date, cvv) VALUES ($1, $2, $3, $4)",
            [userBooked,card_no, date, cvv ]
        );
        
        const paymentDetails = await db.query('SELECT * FROM cardpayment ORDER BY id DESC LIMIT 1')
        const showDetails = await db.query('SELECT * FROM showdetails ORDER BY id DESC LIMIT 1');
        return res.render("paymentDoneCard.ejs",{paymentDetails: paymentDetails.rows[0],showDetails:showDetails.rows[0],phone_no});

    } catch (error) {
        console.error("Error occurred while processing upi payment:", error);
        res.status(500).send("Internal server error");
    }
});



app.listen(port, () => {
    console.log(`server is running on http://localhost:${port}`);
});