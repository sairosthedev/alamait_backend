require('dotenv').config();
const mongoose = require('mongoose');
const Residence = require('../src/models/Residence');
const User = require('../src/models/User');

const saveBelvedereProperty = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find an admin user to set as manager
        const adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) {
            throw new Error('No admin user found. Please create an admin user first using npm run create-admin');
        }

        const singleRoomImages = [
            "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af",  // Single room view
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267",  // Single room desk
            "https://images.unsplash.com/photo-1513694203232-719a280e022f"   // Single room bed
        ];

        const doubleRoomImages = [
            "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf",  // Double room view
            "https://images.unsplash.com/photo-1595526384581-dd9c86b4d0f4",  // Double room beds
            "https://images.unsplash.com/photo-1595526384763-b6e4b16265b5"   // Double room desk
        ];

        const tripleRoomImages = [
            "https://images.unsplash.com/photo-1507652313519-d4e9174996dd",  // Triple room view
            "https://images.unsplash.com/photo-1507652955-f3dcef5a3be5",     // Triple room study area
            "https://images.unsplash.com/photo-1507652313519-d4e9174996dd"   // Triple room common space
        ];

        const quadRoomImages = [
            "https://images.unsplash.com/photo-1628745277752-8dabs84e7a74",  // Quad room view
            "https://images.unsplash.com/photo-1628744448840-55847c1f1f02",  // Quad room study
            "https://images.unsplash.com/photo-1628744448836-0d434f5f505d"   // Quad room beds
        ];

        const belvedereProperty = {
            name: "Belvedere Student House",
            description: "Located in the heart of Belvedere, our student accommodation offers a perfect blend of comfort and convenience. With easy access to major universities and amenities, it's an ideal choice for students seeking quality living.",
            address: {
                street: "12 Belvedere Road",
                city: "Belvedere",
                state: "Harare",
                country: "Zimbabwe"
            },
            location: {
                type: "Point",
                coordinates: [-17.8252, 31.0335] // Coordinates for Harare
            },
            rooms: [
                {
                    roomNumber: "A1",
                    type: "single",
                    price: 180,
                    status: "available",
                    features: [
                        "Private bathroom",
                        "Study desk",
                        "Built-in wardrobe"
                    ],
                    amenities: ["wifi", "ac", "desk", "bathroom", "mirror"],
                    floor: 1,
                    area: 20,
                    images: singleRoomImages,
                    capacity: 1
                },
                {
                    roomNumber: "B1",
                    type: "double",
                    price: 150,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Twin beds",
                        "Study area"
                    ],
                    amenities: ["wifi", "ac", "desk", "bathroom", "mirror"],
                    floor: 1,
                    area: 30,
                    images: doubleRoomImages,
                    capacity: 2
                },
                {
                    roomNumber: "C1",
                    type: "triple",
                    price: 130,
                    status: "available",
                    features: [
                        "Shared facilities",
                        "Common room access",
                        "Study space"
                    ],
                    amenities: ["wifi", "ac", "desk", "bathroom", "mirror"],
                    floor: 1,
                    area: 35,
                    images: tripleRoomImages,
                    capacity: 3
                },
                {
                    roomNumber: "D1",
                    type: "quad",
                    price: 120,
                    status: "available",
                    features: [
                        "Shared bathroom",
                        "Common study area",
                        "Quad arrangement"
                    ],
                    amenities: ["wifi", "ac", "desk", "bathroom", "mirror"],
                    floor: 2,
                    area: 40,
                    images: quadRoomImages,
                    capacity: 4
                }
            ],
            amenities: [
                {
                    name: "High-Speed WiFi",
                    description: "Fast and reliable internet throughout the building",
                    icon: "Wifi"
                },
                {
                    name: "Study Areas",
                    description: "Multiple quiet study spaces and common areas",
                    icon: "BookOpen"
                },
                {
                    name: "Air Conditioning",
                    description: "Climate control in all rooms",
                    icon: "Wind"
                },
                {
                    name: "Security",
                    description: "24/7 security and access control",
                    icon: "Shield"
                }
            ],
            images: [
                {
                    url: "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf",
                    caption: "Modern student living"
                },
                {
                    url: "https://images.unsplash.com/photo-1618221469555-7f3ad97540d6",
                    caption: "Study area"
                }
            ],
            rules: [
                {
                    title: "Quiet Hours",
                    description: "Quiet hours are from 10 PM to 6 AM"
                },
                {
                    title: "Visitors",
                    description: "Visitors must sign in at reception and leave by 10 PM"
                },
                {
                    title: "Common Areas",
                    description: "Keep common areas clean and tidy"
                }
            ],
            features: [
                {
                    name: "Location",
                    description: "Close to major universities",
                    icon: "MapPin"
                },
                {
                    name: "Security",
                    description: "24/7 security personnel and CCTV",
                    icon: "Shield"
                },
                {
                    name: "Facilities",
                    description: "Modern amenities and study spaces",
                    icon: "LayoutDashboard"
                }
            ],
            manager: adminUser._id,
            status: "active",
            contactInfo: {
                email: "belvedere@alamait.com",
                phone: "+263786209200",
                website: "https://alamait.com/belvedere"
            }
        };

        // Check if Belvedere property already exists
        const existingProperty = await Residence.findOne({ name: "Belvedere Student House" });
        
        if (existingProperty) {
            console.log('Belvedere property already exists. Updating...');
            const updated = await Residence.findByIdAndUpdate(
                existingProperty._id,
                belvedereProperty,
                { new: true }
            );
            console.log('Belvedere property updated successfully');
            return;
        }

        // Create new property
        const residence = new Residence(belvedereProperty);
        await residence.save();
        console.log('Belvedere property saved successfully');

    } catch (error) {
        console.error('Error saving Belvedere property:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
};

// Execute the function
saveBelvedereProperty(); 