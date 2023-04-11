
/* IMPORT MODULES */
const express = require('express');
const nodemailer = require('nodemailer');
const app = express();
const dfff = require('dialogflow-fulfillment');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const fs = require('fs');

/* BOT TINGS */
var admin = require("firebase-admin");
var serviceAccount = require("./config/alan-f9qc-firebase-adminsdk-4nvfu-de157495fc.json");

/* SERVER VALIDATION */
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


/* GENERAL USE UTILITY FUNCTIONS */

// Get current date
function current_date() {
    const date = new Date()
    let day = date.getDate()
    let month = date.getMonth() + 1
    let year = date.getFullYear()
    let fullDate = `${month}/${day}/${year}`
    return fullDate
}
const date = current_date();

// Send email with PDF attachment
async function send_email_with_attchmt(to, subject, body, filePath) {

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        // user: '',    // our fake email
        // pass: ''                // our unique bot key to bypass google security
      }
    });
  
    // read the PDF file from disk
    let pdf = fs.readFileSync(filePath);
  
    // create an email message with attachment
    let message = {
      from: 'USF AlanBot', // sender address
      to: to, // list of receivers
      subject: subject, // Subject line
      html: body, // HTML body
      attachments: [
        {
          filename: filePath, // filename to be sent as attachment
          content: pdf, // file content
          contentType: 'application/pdf' // content type
        }
      ]
    };
  
    // send mail with defined transport object
    let info = await transporter.sendMail(message);
  
    console.log('Message sent: %s', info.messageId);

    // delete file after sending
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`File has been deleted successfully.`);
    } else {
        console.log(`File does not exist.`);
    }
  }


/* INTENTS */

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

async function intern_auto_fill(agent){
    var u_number = agent.context.get("intern_form_disclaimer-followup").parameters['U-ID'];
    var pin = agent.context.get("intern_form_disclaimer-followup").parameters['pin'];
    // get student user from database
    const snapshot = await database.ref('/' + u_number).once('value');
    const student = snapshot.val();
    // if the student has a valid (u-id, pin), populate form fields with their info
    if (student.u_number == u_number && student.pin_number == pin) {
        var path = '';
        if (student.major == 'cpe' || student.major == 'cs'){
            // load cse/cs internship form
            path = 'cse-intern-form.pdf';
        }
        else{
            // load cpe/it internship
            path = 'cys-intern-form.pdf';
        }
        const pdfBytes = fs.readFileSync(path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const form = pdfDoc.getForm();
        // get unpopulated text fields
        var last_name_field;
        if (student.major == 'cpe' || student.major == 'cs'){
            // load cse/cs internship form
            last_name_field = form.getTextField('Text1');
        }
        else{
            // load cpe/it internship
            last_name_field = form.getTextField('Text9');
        }
        const first_name_field = form.getTextField('Text2');
        const date_field = form.getTextField('Text3');
        const u_number_field = form.getTextField('Text4');
        const address_field = form.getTextField('Text5');
        const email_field = form.getTextField('Text6');
        const classification_field = form.getTextField('Text7');        
        last_name_field.setText(student.last_name);
        first_name_field.setText(student.first_name);
        date_field.setText(date);
        u_number_field.setText(student.u_number);
        address_field.setText(student.street_address);
        email_field.setText(student.email);
        classification_field.setText(student.class_level)
        // save the modified PDF to a file
        const newPdfBytes = await pdfDoc.save();
        fs.writeFileSync('auto-fill-internship.pdf', newPdfBytes);
        // send email to student
        send_email_with_attchmt(student.email, 'Your Industry Internship Form', '<p>Your Industry Internship form is attached. Please verify that all the information is correct before sending it your supervising professor.</p><p>- <b>Alan, CSE Chatbot</b></p>', 'auto-fill-internship.pdf');

        var payloadData = {
            "richContent":[
                [
                    {
                        "type": "description",
                        "title": "Hi " + student.first_name + ",",
                        "text": [
                            "I just sent the auto-filled Industry Internship form to the email address we have on hand for you: " + student.email,
                            "Please check your spam folder if you are having trouble locating it."
                        ]
                    },
                    {
                    "options": [
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
    }
    else {
        var payloadData = {
            "richContent":[
                [
                    {
                        "type": "description",
                        "title": "Invalid PIN or U Number",
                        "text": [
                            "Unfortunately, your UID and pin are not valid. Please try again or contact USF IT for help.",
                        ]
                    },
                        {
                        "options": [
                            {
                                "text": "Auto-fill my ULDP Form"
                            },
                            {
                                "text": "I don't know my PIN or UID"
                            },
                            {
                                "text": "I need something else"
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
    }

}

async function uldp_auto_fill(agent) {

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
    if (student && student.pin_number == pin && student.uldp == 'FALSE') {
        last_name_field.setText(student.last_name);
        first_name_field.setText(student.first_name);
        u_number_field.setText('U' + student.u_number);
        date_field.setText(date);

        // retrieve student's major to check the correct box
        switch (student.major) {
            case 'cpe':
                const cpe_field = form.getCheckBox('Button7');
                cpe_field.check();
                break;
            case 'cs':
                const cs_field = form.getCheckBox('Button8');
                cs_field.check();
                break;
            case 'cys':
                const cys_field = form.getCheckBox('Button9');
                cys_field.check();
                break;
            case 'it':
                const it_field = form.getCheckBox('Button10');
                it_field.check();
                break;
            default:
                break;
            }

        // save the modified PDF to a file
        const newPdfBytes = await pdfDoc.save();
        fs.writeFileSync('auto-fill-uldp.pdf', newPdfBytes);

        // send email to student
        send_email_with_attchmt(student.email, 'Your ULDP Form', '<p>Your ULDP form is attached. After verifying that all the information is correct, please initial and sign it before sending it to your advisor.</p><p>- <b>Alan, CSE Chatbot</b></p>', 'auto-fill-uldp.pdf');

        var payloadData = {
            "richContent":[
                [
                    {
                        "type": "description",
                        "title": "Hi " + student.first_name + ",",
                        "text": [
                            "I just sent the auto-filled ULDP form to the email address we have on hand for you: " + student.email,
                            "Please check your spam folder if you are having trouble locating it."
                        ]
                    },
                    {
                    "options": [
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
    } else if (student && student.pin_number == pin && student.uldp == 'TRUE') { 
        var payloadData = {
            "richContent":[
                [
                    {
                        "type": "description",
                        "title": "You're already considered an Upper Level student.",
                        "text": [
                            "According to our database, you're already an upper level student. You can double check this by navigating to DegreeWorks and verifying that you have the ULDP attribute. If you think this is an error, please contact your advisor.",
                        ]
                    },
                        {
                        "options": [
                            {
                                "text": "Who is my advisor?"
                            },
                            {
                                "text": "Email my advisor"
                            },
                            {
                                "text": "I need something else"
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
    }
    else {
        var payloadData = {
            "richContent":[
                [
                    {
                        "type": "description",
                        "title": "Invalid PIN or U Number",
                        "text": [
                            "Unfortunately, your UID and pin are not valid. Please try again or contact USF IT for help.",
                        ]
                    },
                        {
                        "options": [
                            {
                                "text": "Auto-fill my ULDP Form"
                            },
                            {
                                "text": "I don't know my PIN or UID"
                            },
                            {
                                "text": "I need something else"
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
    }

}

async function indpt_auto_fill(agent) {

    var u_number = agent.context.get("indpt-uid").parameters['U-ID'];
    var pin = agent.context.get("indpt-pin").parameters['pin'];

    // get student user from database
    const snapshot = await database.ref('/' + u_number).once('value');
    const student = snapshot.val();

    // if student exists but is not ULDP redirect them
    if (student.u_number == u_number && student.pin_number == pin && student.uldp == 'FALSE') {
        var payloadData = {
            "richContent":[
                [
                    {
                        "type": "description",
                        "title": "You are not an Upper Level student.",
                        "text": [
                            "According to our database, you are not considered an upper level student, which is one of the requirements necessary to taking Independent Study CIS/COP 4900. You can double check this by navigating to DegreeWorks and verifying that you are missing the ULDP attribute.",
                            "If you need to apply for ULDP status, click one of the options below or contact your advisor if you believe this is an error."
                        ]
                    },
                        {
                        "options": [
                            {
                                "text": "Upper Level Degree Progression"
                            },
                            {
                                "text": "Who is my advisor?"
                            },
                            {
                                "text": "Email my advisor"
                            },
                            {
                                "text": "I need something else"
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
    } 
    
    // if student exists and is ULDP, fill out the form
    else if (student.u_number == u_number && student.pin_number == pin && student.uldp == 'TRUE') { 

        if (student.major == "cpe" || student.major == "cs" ) {

            // load empty cse/cs form
            const pdfBytes = fs.readFileSync('cse-indpt-form.pdf');
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const form = pdfDoc.getForm();

            // get unpopulated text fields
            const last_name_field = form.getTextField('Text1');
            const first_name_field = form.getTextField('Text7');
            const date_field = form.getTextField('Text2');
            const u_number_field = form.getTextField('Text3');
            const addy_field = form.getTextField('Text4'); 
            const email_field = form.getTextField('Text5');
            const classification_field = form.getTextField('Text6');

            // set fields
            last_name_field.setText(student.last_name);
            first_name_field.setText(student.first_name);
            date_field.setText(date);
            u_number_field.setText(student.u_number);
            addy_field.setText(student.street_address); 
            email_field.setText(student.email);
            classification_field.setText(student.class_level);

            // save the modified PDF to a file
            const newPdfBytes = await pdfDoc.save();
            fs.writeFileSync('auto-fill-cse-indpt.pdf', newPdfBytes);

            // send email to student
            send_email_with_attchmt(student.email, 'Your Independent Study Form', '<p>Your Independent Study form is attached. After verifying that all the information is correct, please fill in your phone number and proposed statement of work before sending it to <a href="mailto:whendrix@usf.edu">Dr. Hendrix</a>.</p><p>- <b>Alan, CSE Chatbot</b></p>', 'auto-fill-cse-indpt.pdf');

            var payloadData = {
                "richContent":[
                    [
                        {
                            "type": "description",
                            "title": "Hi " + student.first_name + ",",
                            "text": [
                                "I just sent the auto-filled Independent Study form to the email address we have on hand for you: " + student.email,
                                "Please check your Spam or Quarantine folder if you are having trouble locating it."
                            ]
                        },
                        {
                            "icon": {
                              "type": "policy",
                              "color": "#006747"
                            },
                            "link": "https://security.microsoft.com/quarantine",
                            "type": "button",
                            "text": "Your Quarantine Folder"
                        },
                        {
                        "options": [
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


        } else if (student.major == "cys" || student.major == "it") {

            // load empty cys/it form
            const pdfBytes = fs.readFileSync('cys-indpt-form.pdf');
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const form = pdfDoc.getForm();

            // get unpopulated text fields
            const last_name_field = form.getTextField('Text1');
            const first_name_field = form.getTextField('Text2');
            const date_field = form.getTextField('Text3');
            const u_number_field = form.getTextField('Text4');
            const addy_field = form.getTextField('Text5'); 
            const email_field = form.getTextField('Text6');
            const classification_field = form.getTextField('Text7');

            // set fields
            last_name_field.setText(student.last_name);
            first_name_field.setText(student.first_name);
            date_field.setText(date);
            u_number_field.setText(student.u_number);
            addy_field.setText(student.street_address); 
            email_field.setText(student.email);
            classification_field.setText(student.class_level);

            // save the modified PDF to a file
            const newPdfBytes = await pdfDoc.save();
            fs.writeFileSync('auto-fill-cysit-indpt.pdf', newPdfBytes);

            // send email to student
            send_email_with_attchmt(student.email, 'Your Independent Study Form', '<p>Your Independent Study form is attached. After verifying that all the information is correct, please fill in your phone number and proposed statement of work before sending it to <a href="mailto:sksmall@usf.edu">Dr. Small</a>.</p><p>- <b>Alan, CSE Chatbot</b></p>', 'auto-fill-cysit-indpt.pdf');

            var payloadData = {
                "richContent":[
                    [
                        {
                            "type": "description",
                            "title": "Hi " + student.first_name + ",",
                            "text": [
                                "I just sent the auto-filled Independent Study form to the email address we have on hand for you: " + student.email,
                                "Please check your Spam or Quarantine folder if you are having trouble locating it."
                            ]
                        },
                        {
                            "icon": {
                              "type": "policy",
                              "color": "#006747"
                            },
                            "link": "https://security.microsoft.com/quarantine",
                            "type": "button",
                            "text": "Your Quarantine Folder"
                        },
                        {
                        "options": [
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

        } else if (student.major == "other") {

            var payloadData = {
                "richContent":[
                    [
                        {
                            "type": "description",
                            "title": "You are not in the Department of Computer Science and Engineering.",
                            "text": [
                                "According to our database, you are not a Computer Science, Computer Engineering, Information Technology, or Cybersecurity major which is one of the requirements necessary to taking Independent Study CIS/COP 4900. You can double check this by navigating to DegreeWorks and verifying your listed major.",
                                "Please contact your advisor if you believe this is an error."
                            ]
                        },
                            {
                            "options": [
                                {
                                    "text": "Who is my advisor?"
                                },
                                {
                                    "text": "Email my advisor"
                                },
                                {
                                    "text": "I need something else"
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

        }
          
    }

    // if u number and pin don't match
    else {
        var payloadData = {
            "richContent":[
                [
                    {
                        "type": "description",
                        "title": "Invalid PIN or U Number",
                        "text": [
                            "Unfortunately, your UID and pin are not valid. Please try again or contact USF IT for help.",
                        ]
                    },
                        {
                        "options": [
                            {
                                "text": "I don't know my PIN or UID"
                            },
                            {
                                "text": "I need something else"
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
    }

}


var intentMap = new Map();
intentMap.set('uldp_auto_fill', uldp_auto_fill)
intentMap.set('indpt_auto_fill', indpt_auto_fill)
intentMap.set('gpa', gpa)
intentMap.set('intern_auto_fill',intern_auto_fill)
agent.handleRequest(intentMap);
})

app.listen(3333, ()=>console.log("Server is live at port 3333"));
