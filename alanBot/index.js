const express = require('express');
const app = express();
const dfff = require('dialogflow-fulfillment');


var admin = require("firebase-admin");

var serviceAccount = require("./config/alan-f9qc-firebase-adminsdk-4nvfu-de157495fc.json");

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://alan-f9qc-default-rtdb.firebaseio.com"
    });

    console.log("Connected to DB")
} catch (error) {
    console.log("Error here" + error);
}

var db = admin.firestore();

app.get('/', (req, res)=> {
    res.send("We are live")
});

app.post('/', express.json(), (req, res)=> {
    const agent = new dfff.WebhookClient({
        request: req,
        response: res
    });
   
    function demo(agent){
        agent.add("Sending response from Webhook server");
    }

    function customPayloadDemo(agent) {
        var payloadData = {
            "richContent":[
                [
                    {
                        "type": "accordion",
                        "title": "Accordion title",
                        "subtitle": "Accordion subtitleAccordion subtitle",
                        "image": {
                            "src": {
                                "rawUrl": "https/example.com/images/logo.png"
                            }
                        },
                        "text": "Accordion text"
                    }
                ]
            ]
        }
        agent.add(new dfff.Payload(agent.UNSPECIFIED, payloadData, {sendAsMessage: true, rawPayload: true }))
    }
    
    function finalConfirmation(agent) {
        var name = agent.context.get("awaiting-name").parameters['given-name'];
        var email = agent.context.get("awaiting-email").parameters.email;
        console.log(name);
        console.log(email);
        agent.add('Hello ' + name + ', your email: ' + email + '. We confirmed your meeting.');
        return db.collection('meeting').add({
            name: name,
            email: email,
            time: Date.now()
        }).then(ref =>
            // Fetching free slots from G-cal
            console.log("Meeting details added to DB")
        )
    }

    function gpa(agent) {

        var u_number = agent.context.get("u_number").parameters.number;
        console.log(u_number);
        
        return db.collection('mock')
        .where("u_number", "==", u_number)
        .get()
        .then(ref => {
            const matched_gpa = ref.docs.map((doc) => doc.data().gpa);
            const matched_first_name = ref.docs.map((doc) => doc.data().first_name);
            const matched_last_name = ref.docs.map((doc) => doc.data().last_name);
            var payloadData = {
                "richContent":[
                    [
                        {
                            "type": "info",
                            "title": "Hi " + matched_first_name + " " + matched_last_name + "!",
                            "subtitle": "Your GPA is: " + matched_gpa,
                        },
                        {
                            "options": [
                              {
                                "text": "Grade Forgiveness"
                              },
                              {
                                "text": "I need help with something else"
                              },
                              {
                                "text": "Bye!"
                              }
                            ],
                            "type": "chips"
                          }
                    ]
                ]
            }
            agent.add(new dfff.Payload(agent.UNSPECIFIED, payloadData, {sendAsMessage: true, rawPayload: true }))
        })
        .catch((error) => {
            console.error("Error getting documents ", error);
        });

    }

    var intentMap = new Map();
    intentMap.set('gpa', gpa)
    intentMap.set('finalConfirmation', finalConfirmation)
    intentMap.set('webhookDemo', demo)
    intentMap.set('customPayloadDemo', customPayloadDemo)
    agent.handleRequest(intentMap);
})

app.listen(3333, ()=>console.log("Server is live at port 3333"));
