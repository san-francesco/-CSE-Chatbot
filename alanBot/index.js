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
            const matchedGpa = ref.docs.map((doc) => doc.data().gpa);
            agent.add("DATA FETCHED FROM FIREBASE: " + matchedGpa);  
        })
        .catch((error) => {
            console.error("Error getting documents ", error);
        });

    }

    function uldpFormConfirmUID(agent) {
        agent.add("Sending response from Webhook server");

        var u_number = agent.context.get("awaiting-UID").parameters['U-ID'];

        console.log(u_number);
        
        return db.collection('mock')
        .where("u_number", "==", u_number)        
        .get()
        .then(ref => {
            agent.add("Whats your pin?");          
        })
        .catch((error) => {
            agent.add("This pin does not match with the UID, please try again.");
            console.error("Error getting documents ", error);
        });
    }
    function uldpFormConfirmPin(agent) {

        var pin = agent.context.get("awaiting-pin").parameters['pin'];

        console.log(pin);
        
        return db.collection('mock')
        .where("pin_number", "==", pin)        
        .get()
        .then(ref => {
            const gpa = ref.docs.map((doc) => doc.data().gpa);
            agent.add("AUTHENTICATED");          
        })
        .catch((error) => {
            agent.add("This pin does not match with the UID, please try again.");
            console.error("Error getting documents ", error);
        });
    }

    var intentMap = new Map();
    intentMap.set('uldpFormConfirmUID',uldpFormConfirmUID)

    intentMap.set('uldpFormConfirmPin',uldpFormConfirmPin)
    intentMap.set('gpa', gpa)
    intentMap.set('finalConfirmation', finalConfirmation)
    intentMap.set('webhookDemo', demo)
    intentMap.set('customPayloadDemo', customPayloadDemo)
    agent.handleRequest(intentMap);
})

app.listen(3333, ()=>console.log("Server is live at port 3333"));