const express = require('express');
const app = express();
const dfff = require('dialogflow-fulfillment');
const csv = require('csv-parser');
const fs = require('fs');

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

const db = admin.firestore();
const database = admin.database();

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

        var u_number = agent.context.get("u_number").parameters['U-ID'];
        var pin = agent.context.get("u_number").parameters['pin'];

        return database.ref('/' + u_number).once('value').then((snapshot) => {
            const student = snapshot.val();
            if (student && student.pin_number == pin){
                var payloadData = {
                    "richContent":[
                        [
                            {
                                "type": "info",
                                "title": "Hi " + student.first_name + " " + student.last_name + "!",
                                "subtitle": "Your GPA is: " + student.gpa
                            }
                        ]
                    ]
                }
                agent.add(new dfff.Payload(agent.UNSPECIFIED, payloadData, {sendAsMessage: true, rawPayload: true }))            }
            else{
                console.log('its in here');
                agent.add('Unfortunately, your UID and pin are not valid. Please try again or contact USF IT for help.');
            }
        });

    }

    // function uldpFormConfirmUID(agent) {
    //     var u_number = agent.context.get("awaiting-UID").parameters['U-ID'];
        
    //     return database.ref('/' + u_number).once('value').then((snapshot) => {
    //         const student = snapshot.val();
    //         if (student){
    //             agent.add('Hi' + student.first_name + '! What is your pin?');
    //         }
    //         else{
    //             agent.add('Unfortunately, your u-number does not exist in my database. Please check your entry and try again.');
    //         }
    //     });
    // }

    // function uldpFormConfirmPin(agent) {

    //     var pin = agent.context.get("awaiting-pin").parameters['pin'];
    //     var u_number = agent.context.get("awaiting-UID").parameters['U-ID'];

    //     console.log(pin);
    //     console.log(u_number);
        
    //     return db.collection('mock')
    //     .where("u_number", "==", u_number).where("pin_number", "==", pin)        
    //     .get()
    //     .then(ref => {
    //         const gpa = ref.docs.map((doc) => doc.data().gpa);
    //         agent.add("AUTHENTICATED: " + gpa);          
    //     })
    //     .catch((error) => {
    //         agent.add("This pin does not match with the UID, please try again.");
    //         console.error("Error getting documents ", error);
    //     });
    // }

    var intentMap = new Map();
    // intentMap.set('uldpFormConfirmUID',uldpFormConfirmUID)
    // intentMap.set('uldpFormConfirmPin',uldpFormConfirmPin)
    intentMap.set('gpa', gpa)
    intentMap.set('finalConfirmation', finalConfirmation)
    intentMap.set('webhookDemo', demo)
    intentMap.set('customPayloadDemo', customPayloadDemo)
    agent.handleRequest(intentMap);
})

app.listen(3333, ()=>console.log("Server is live at port 3333"));