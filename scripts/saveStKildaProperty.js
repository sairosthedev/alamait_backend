require('dotenv').config();
const mongoose = require('mongoose');
const Residence = require('../src/models/Residence');
const User = require('../src/models/User');

const saveStKildaProperty = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find an admin user to set as manager
        const adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) {
            throw new Error('No admin user found. Please create an admin user first using npm run create-admin');
        }

        const stKildaProperty = {
            name: "St Kilda Student House",
            description: "Nestled in the peaceful St Kilda neighborhood, our student house combines modern comfort with a serene study environment. Featuring well-equipped common areas and a supportive student community, it's perfect for academic success.",
            address: {
                street: "4 St Kilda Road",
                city: "St Kilda",
                state: "Harare",
                country: "Zimbabwe"
            },
            location: {
                type: "Point",
                coordinates: [-17.8252, 31.0335] // Approximate coordinates for Harare
            },
            manager: adminUser._id, // Set the admin user as manager
            rooms: [
                {
                    roomNumber: "Exclusive Room",
                    type: "single",
                    price: 220,
                    status: "available",
                    features: [
                        "Built-in wardrobe",
                        "Mirror",
                        "High-Speed WiFi",
                        "Study Desk",
                        "Air Conditioning"
                    ],
                    floor: 1,
                    area: 20
                },
                {
                    roomNumber: "C1",
                    type: "double",
                    price: 190,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Common study area",
                        "High-Speed WiFi",
                        "Air Conditioning"
                    ],
                    floor: 1,
                    area: 25
                },
                {
                    roomNumber: "C2",
                    type: "double",
                    price: 190,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Common study area",
                        "High-Speed WiFi",
                        "Air Conditioning"
                    ],
                    floor: 1,
                    area: 25
                },
                {
                    roomNumber: "M1",
                    type: "studio",
                    price: 180,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Common study area",
                        "High-Speed WiFi",
                        "Air Conditioning"
                    ],
                    floor: 2,
                    area: 30
                },
                {
                    roomNumber: "M2",
                    type: "double",
                    price: 170,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Common study area",
                        "High-Speed WiFi",
                        "Air Conditioning"
                    ],
                    floor: 2,
                    area: 25
                },
                {
                    roomNumber: "M3",
                    type: "double",
                    price: 180,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Common study area",
                        "High-Speed WiFi",
                        "Air Conditioning"
                    ],
                    floor: 2,
                    area: 25
                },
                {
                    roomNumber: "M4",
                    type: "double",
                    price: 180,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Walk in closet",
                        "High-Speed WiFi",
                        "Air Conditioning"
                    ],
                    floor: 2,
                    area: 25
                },
                {
                    roomNumber: "M5",
                    type: "double",
                    price: 180,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Common study area",
                        "High-Speed WiFi",
                        "Air Conditioning"
                    ],
                    floor: 2,
                    area: 25
                },
                {
                    roomNumber: "M6",
                    type: "double",
                    price: 180,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Walk in closet",
                        "High-Speed WiFi",
                        "Air Conditioning"
                    ],
                    floor: 2,
                    area: 25
                },
                {
                    roomNumber: "M7",
                    type: "double",
                    price: 180,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Built in wardrobe",
                        "High-Speed WiFi",
                        "Air Conditioning"
                    ],
                    floor: 2,
                    area: 25
                },
                {
                    roomNumber: "M8",
                    type: "apartment",
                    price: 160,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Common study area",
                        "High-Speed WiFi",
                        "Air Conditioning",
                        "Kitchenette"
                    ],
                    floor: 3,
                    area: 40
                },
                {
                    roomNumber: "Bus1",
                    type: "apartment",
                    price: 160,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Common study area",
                        "High-Speed WiFi",
                        "Air Conditioning",
                        "Kitchenette"
                    ],
                    floor: 3,
                    area: 40
                },
                {
                    roomNumber: "Bus2",
                    type: "apartment",
                    price: 160,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Basic furniture",
                        "High-Speed WiFi",
                        "Air Conditioning",
                        "Kitchenette"
                    ],
                    floor: 3,
                    area: 35
                },
                {
                    roomNumber: "Extension 1",
                    type: "apartment",
                    price: 160,
                    status: "available",
                    features: [
                        "Large windows",
                        "Double bed",
                        "High-Speed WiFi",
                        "Air Conditioning",
                        "Coffee Station",
                        "Kitchenette"
                    ],
                    floor: 1,
                    area: 35
                },
                {
                    roomNumber: "Extension 2",
                    type: "single",
                    price: 160,
                    status: "available",
                    features: [
                        "Corner room",
                        "Extra storage",
                        "High-Speed WiFi",
                        "Air Conditioning"
                    ],
                    floor: 1,
                    area: 15
                }
            ],
            amenities: [
                {
                    name: "No Gender Preference",
                    description: "Rooms available for all genders",
                    icon: "Users"
                },
                {
                    name: "Quiet Study Area",
                    description: "Dedicated spaces for focused studying",
                    icon: "BookOpen"
                },
                {
                    name: "24/7 Security",
                    description: "Round-the-clock security for your safety",
                    icon: "Shield"
                },
                {
                    name: "Utilities Included",
                    description: "All utilities included in the rent",
                    icon: "Zap"
                },
                {
                    name: "Maintenance",
                    description: "Regular maintenance service",
                    icon: "Wrench"
                }
            ],
            images: [
                {
                    url: "/stkilda-main.jpg",
                    caption: "Main Building"
                },
                {
                    url: "/stkilda1.jpg",
                    caption: "Common Area"
                },
                {
                    url: "/stkilda2.jpg",
                    caption: "Study Room"
                },
                {
                    url: "/stkilda3.jpg",
                    caption: "Bedroom"
                },
                {
                    url: "/stkilda4.jpg",
                    caption: "Kitchen"
                },
                {
                    url: "/hos5.jpeg",
                    caption: "Building Exterior"
                },
                {
                    url: "/hos7.jpeg",
                    caption: "Student Lounge"
                },
                {
                    url: "/hos9.jpeg",
                    caption: "Study Area"
                }
            ],
            rules: [
                {
                    title: "Quiet Hours",
                    description: "10 PM - 6 AM daily"
                },
                {
                    title: "Visitors",
                    description: "Visitors allowed until 9 PM"
                },
                {
                    title: "Cleaning",
                    description: "Keep common areas clean"
                }
            ],
            features: [
                {
                    name: "Study Areas",
                    description: "Multiple quiet study spaces",
                    icon: "BookOpen"
                },
                {
                    name: "High-Speed Internet",
                    description: "Fast and reliable WiFi throughout",
                    icon: "Wifi"
                },
                {
                    name: "Security",
                    description: "24/7 security personnel",
                    icon: "Shield"
                }
            ],
            status: "active",
            contactInfo: {
                email: "stkilda@alamait.com",
                phone: "+263786209200",
                website: "https://alamait.com/stkilda"
            }
        };

        // Check if St Kilda property already exists
        const existingProperty = await Residence.findOne({ name: "St Kilda Student House" });
        
        if (existingProperty) {
            console.log('St Kilda property already exists. Updating...');
            const updated = await Residence.findByIdAndUpdate(
                existingProperty._id,
                stKildaProperty,
                { new: true }
            );
            console.log('St Kilda property updated successfully');
            return;
        }

        // Create new property
        const residence = new Residence(stKildaProperty);
        await residence.save();
        console.log('St Kilda property saved successfully');

    } catch (error) {
        console.error('Error saving St Kilda property:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

saveStKildaProperty(); 