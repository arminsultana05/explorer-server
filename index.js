const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// console.log(process.env.STRIPE_SECRET_KEY);


const port = process.env.PORT || 5000;
const app = express();

// app.use(cors());
const corsFonfig = {
    origin: true,
    Credentials: true,
}
app.use(cors(corsFonfig));
app.options("*", cors(corsFonfig));
app.use(bodyParser.json());


//JWT Token
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized Access" });
    }
    const token = authHeader.split(" ")[1];
    console.log(token)
    jwt.verify(token, process.env.TOKEN, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: "Forbidden access" });
        }
        // console.log("decoded", decoded);
        req.decoded = decoded;
        next();
    });
}


const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.gnh2i.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const run = async () => {
    try {
        await client.connect();
        console.log("Connected to MongoDB");

        const db = client.db("explorer");
        const blogCollection = db.collection("blogCollection");
        const themeCollection = db.collection("themeCollection");
        const usersCollection = db.collection("usersCollection");
        const memberrshipPlanCollection = db.collection("memberrshipPlanCollection");
        const purchesCollection = db.collection("purchesCollection");
        // const purchesCollection = db.collection("purchesCollection");

        // API to Run Server 
        app.get("/", async (req, res) => {
            res.send("Server is Running");
        });

        //Pagination
        //Get blogs count
        app.get("/blogs-count", async (req, res) => {
            const query = {};
            const count = await blogCollection.find(query).count();
            res.send({ count });
        }
        );

        // API to Get All Blogs + pagination
        app.get("/blogs", async (req, res) => {
            const page = parseInt(req.query.page);
            const count = parseInt(req.query.count);
            const cursor = blogCollection.find({});
            let blogs;
            if (page || count) {
                blogs = await cursor.skip(page * count).limit(count).toArray();
            } else {
                blogs = await cursor.toArray();
            }
            res.send(blogs);
        }
        );

        // API to Get Blog by Id
        app.get("/blogs/:id", async (req, res) => {
            const id = req.params.id;
            const blog = await blogCollection.findOne({ _id: ObjectId(id) });
            res.send(blog);
        }
        );

        //API to post a blog
        app.post("/blogs", async (req, res) => {
            const blog = req.body;
            // console.log(blog);
            const result = await blogCollection.insertOne(blog);
            res.send(result);
        }
        );

        //API to update a blog
        app.put("/blogs/:id", async (req, res) => {
            const id = req.params.id;
            const blog = req.body;
            // console.log(blog, "blog");
            const result = await blogCollection.updateOne({ _id: ObjectId(id) }, { $set: blog });
            // console.log(result)
            res.send(result);
        }
        );


        //API to get themes
        app.get("/theme", async (req, res) => {
            const theme = await themeCollection.find({}).toArray();
            res.send(theme);
        }
        );

        // API to put theme state to mongoDB
        app.put('/theme/:id', async (req, res) => {
            const id = req.params.id;
            const theme = req.body;
            // console.log(id, theme);
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: theme
            };
            const result = await themeCollection.updateOne(filter, updateDoc, options);

            res.send(result);
        })

        //GET All users from mongoDB
        app.get("/users", async (req, res) => {
            const users = await usersCollection.find({}).toArray();
            res.send(users);
        }
        );


        //PUT api for update an user by email
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email)
            const user = req.body
            // console.log(user?.photoURL)
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {

                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            const getToken = jwt.sign({ email: email }, process.env.TOKEN, { expiresIn: '1d' })
            res.send({ result, getToken })
        })

        //Stripe Payment method
        app.post('/create-payment-intent', async (req, res) => {
            const service = await req.body;
            const price = service.price
            const amount = price * 100
            if (isNaN(amount) === false) {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card']
                });
                res.send({ clientSecret: paymentIntent.client_secret })
            }
        })

        // app.get('/payment/:id', verifyJWT, async (req, res) => {
        //     const id = req.params.id
        //     const query = { _id: ObjectId(id) }
        //     const order = await purchesCollection.findOne(query)
        //     res.send(order)
        // })

        //Get all membership plans
        app.get("/membership-plans", async (req, res) => {
            const plans = await memberrshipPlanCollection.find({}).toArray();
            res.send(plans);
        }
        );

        //Get membership plan by id
        app.get("/membership-plans/:id", async (req, res) => {
            const id = req.params.id;
            const plan = await memberrshipPlanCollection.findOne({ _id: ObjectId(id) });
            res.send(plan);
        })


        app.put('/ship/:id', async (req, res) => {

            const id = req.params.id;

            const order = req.body;

            const options = { upsert: true }
            const filter = { _id: ObjectId(id) }
            //  console.log(filter,"filter email");
            const updateDoc = {
                $set: {
                    isDeliverd: true
                }

            };
            const result = await purchesCollection.updateOne(filter, updateDoc, options)

            res.send(result)

        })

        app.patch('/orderPay/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const payment = req.body
            const filter = { _id: ObjectId(id) }
            const updateDoc = {

                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                },
            };
            const updateOrder = await purchesCollection.updateOne(filter, updateDoc)
            const result = await paymentCollection.insertOne(payment)
            res.send(updateOrder)
        })


    }
    finally {
        // client.close(); 
    }
}

run().catch(console.dir);

app.listen(port, () => console.log(`Listening on port ${port}`));