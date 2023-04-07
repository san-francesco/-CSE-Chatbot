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

const database = admin.database();

app.get('/', (req, res)=> {
    res.send("We are live")
});

app.post('/', express.json(), (req, res)=> {
    const agent = new dfff.WebhookClient({
        request: req,
        response: res
    });

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


    var intentMap = new Map();
    intentMap.set('gpa', gpa)
    agent.handleRequest(intentMap);
})

app.listen(3333, ()=>console.log("Server is live at port 3333"));
