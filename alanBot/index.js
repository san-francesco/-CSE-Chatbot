const express = require('express');
const app = express();
const dfff = require('dialogflow-fulfillment');
const { PDFDocument, StandardFonts } = require('pdf-lib');
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

const database = admin.database();

app.get('/', (req, res)=> {
    res.send("We are live")
});

app.post('/', express.json(), (req, res)=> {
    const agent = new dfff.WebhookClient({
        request: req,
        response: res
    });

// utility functions
function current_date() {
    const date = new Date()
    let day = date.getDate()
    let month = date.getMonth() + 1
    let year = date.getFullYear()
    let fullDate = `${month}/${day}/${year}`
    return fullDate
}

const date = current_date();



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

    async function industry_internship_db(agent) {

        var u_number = agent.context.get("u-id").parameters['U-ID'];
        var pin = agent.context.get("pin_number").parameters['pin'];
    
        // load empty uldp form
        const pdfBytes = fs.readFileSync('uldp-form.pdf');
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
    
        // get unpopulated text fields
        const last_name_field = form.getTextField('Text1');
        const first_name_field = form.getTextField('Text2');
        const u_number_field = form.getTextField('Text3');
        const date_field = form.getTextField('Text6');
        
        // get student user from database
        const snapshot = await database.ref('/' + u_number).once('value');
        const student = snapshot.val();
    
        // if the student has a valid (u-id, pin), populate form fields with their info
        if (student && student.pin_number == pin) {
            last_name_field.setText(student.last_name);
            first_name_field.setText(student.first_name);
            u_number_field.setText('U' + student.u_number);
            date_field.setText(date);
    
            // save the modified PDF to a file
            const newPdfBytes = await pdfDoc.save();
            fs.writeFileSync('auto-fill-uldp.pdf', newPdfBytes);
    
            // Trigger an event that will prompt the user to download the file
            agent.setFollowupEvent({
                name: 'file_download',
                parameters: {
                    filename: 'auto-fill-uldp.pdf',
                    fileurl: 'https://san-francesco.github.io/alanBot/auto-fill-uldp.pdf'
                }
            });
        }
        else {
            agent.add('Unfortunately, your UID and pin are not valid. Please try again or contact USF IT for help.');
        }
    
    }


    var intentMap = new Map();
    intentMap.set('industry_internship_db', industry_internship_db)
    intentMap.set('gpa', gpa)
    agent.handleRequest(intentMap);
})

app.listen(3333, ()=>console.log("Server is live at port 3333"));
