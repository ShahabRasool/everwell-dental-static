/* Demo content only. Replace these arrays with Drupal entities/views/API data during implementation. */
window.EVERWELL_DATA = {
  doctors: [
    {id:"dr-maya",name:"Dr. Maya Bennett",initials:"MB",specialty:"General Dentistry",credentials:"DDS",clinic:"Downtown",experience:"12 years",days:"Mon, Tue, Thu, Fri",hours:"9:00 AM – 4:00 PM",image:"https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=85",bio:"Known for a calm, reassuring approach to preventive and restorative care.",availability:"Available today"},
    {id:"dr-james",name:"Dr. James Carter",initials:"JC",specialty:"Cosmetic Dentistry",credentials:"DMD",clinic:"Downtown",experience:"10 years",days:"Mon – Thu",hours:"10:00 AM – 5:00 PM",image:"https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=85",bio:"Helps patients explore natural-looking smile enhancements with clear guidance.",availability:"Available today"},
    {id:"dr-olivia",name:"Dr. Olivia Chen",initials:"OC",specialty:"Orthodontics",credentials:"DDS, MS",clinic:"Northside",experience:"9 years",days:"Tue, Wed, Fri",hours:"8:30 AM – 3:30 PM",image:"https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=800&q=85",bio:"Focuses on personalized alignment plans for teens and adults.",availability:"Next opening tomorrow"},
    {id:"dr-noah",name:"Dr. Noah Williams",initials:"NW",specialty:"Endodontics",credentials:"DMD",clinic:"Downtown",experience:"14 years",days:"Mon, Wed, Thu",hours:"9:00 AM – 3:00 PM",image:"https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=800&q=85",bio:"Provides careful, patient-centered treatment for tooth pain and root canal needs.",availability:"Available Thursday"},
    {id:"dr-sophia",name:"Dr. Sophia Martinez",initials:"SM",specialty:"Pediatric Dentistry",credentials:"DDS, Board Certified",clinic:"Northside",experience:"8 years",days:"Mon – Fri",hours:"8:00 AM – 2:00 PM",image:"https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=85",bio:"Makes visits welcoming for children and supports parents with practical advice.",availability:"Available today"},
    {id:"dr-ethan",name:"Dr. Ethan Brooks",initials:"EB",specialty:"General Dentistry",credentials:"DDS",clinic:"Northside",experience:"7 years",days:"Tue – Sat",hours:"10:00 AM – 6:00 PM",image:"https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?auto=format&fit=crop&w=800&q=85",bio:"Enjoys helping patients build simple, sustainable habits for lifelong oral health.",availability:"Next opening Friday"}
  ],
  services: [
    {icon:"✧",name:"General Dentistry",description:"Routine exams, professional cleanings, digital X-rays, and preventive care plans.",duration:"30–60 min",from:"$95"},
    {icon:"◈",name:"Cosmetic Dentistry",description:"Personalized consultations for whitening, veneers, bonding, and smile improvements.",duration:"45–90 min",from:"$150"},
    {icon:"⌁",name:"Restorative Dentistry",description:"Tooth-colored fillings, crowns, bridges, and options to restore comfort and function.",duration:"45–90 min",from:"$180"},
    {icon:"♡",name:"Family Dentistry",description:"Friendly oral health care for children, teens, adults, and older family members.",duration:"30–60 min",from:"$85"},
    {icon:"⌘",name:"Orthodontics",description:"Consultations and treatment planning for braces and clear aligner options.",duration:"30–45 min",from:"$120"},
    {icon:"✦",name:"Emergency Visits",description:"Prompt assessment for tooth pain, swelling, broken teeth, or urgent concerns.",duration:"30–60 min",from:"$125"}
  ],
  appointments: [
    {patient:"Avery Johnson",email:"avery@example.test",doctor:"Dr. Maya Bennett",time:"09:00 AM",service:"General Dentistry",status:"Confirmed"},
    {patient:"Liam Wilson",email:"liam@example.test",doctor:"Dr. James Carter",time:"09:30 AM",service:"Cosmetic Dentistry",status:"Confirmed"},
    {patient:"Emma Davis",email:"emma@example.test",doctor:"Dr. Sophia Martinez",time:"10:30 AM",service:"Family Dentistry",status:"Pending"},
    {patient:"Mason Garcia",email:"mason@example.test",doctor:"Dr. Noah Williams",time:"11:00 AM",service:"Emergency Visits",status:"Confirmed"},
    {patient:"Isabella Brown",email:"isabella@example.test",doctor:"Dr. Olivia Chen",time:"01:30 PM",service:"Orthodontics",status:"Pending"}
  ]
};