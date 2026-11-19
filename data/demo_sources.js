window.SCRIPTLAB_STARTER_DATA = {
  "generatedAt": "2026-11-18T17:12:00.000Z",
  "themes": [
    "identity",
    "truth",
    "home",
    "survival",
    "system",
    "community"
  ],
  "defaultCharacterMap": {
    "Nicholas (“Poodle”)": "POODLE",
    "Milo Parraz": "TRAVELER",
    "Rebecca Mallory": "REBECCA",
    "Man Under Shelter (60)": "MAN UNDER SHELTER",
    "Zhan Petrov": "FILMMAKER (O.S.)",
    "Female Co-Interviewer": "CO-INTERVIEWER (O.S.)"
  },
  "biometrics": {
    "voiceModel": "pyannote/wespeaker-voxceleb-resnet34-LM (256-D Voiceprint)",
    "faceModel": "facenet-pytorch/InceptionResnetV1-vggface2 (512-D MTCNN + FaceNet)",
    "pipelineNote": "Same biometric speaker architecture built for 220 Lab’s Precipice Script Lab.",
    "speakers": {
      "Nicholas (“Poodle”)": {
        "name": "Nicholas (“Poodle”)",
        "character": "POODLE",
        "onCamera": true,
        "face": {
          "clusterId": "FACE-01",
          "embeddingDim": 512,
          "model": "facenet-pytorch/InceptionResnetV1-vggface2",
          "status": "On-camera subject verified"
        },
        "voice": {
          "clusterId": "VOICE-01",
          "embeddingDim": 256,
          "model": "pyannote/wespeaker-voxceleb-resnet34-LM",
          "verifiedTurns": 3
        },
        "excerptId": "ex1",
        "locationLabel": "Muni Light-Rail Platform",
        "fieldNote": "Filmed at night on the Muni light-rail platform in a leopard-print coat with teal-dyed hair and cheek piercings."
      },
      "Milo Parraz": {
        "name": "Milo Parraz",
        "character": "TRAVELER",
        "onCamera": true,
        "face": {
          "clusterId": "FACE-02",
          "embeddingDim": 512,
          "model": "facenet-pytorch/InceptionResnetV1-vggface2",
          "status": "On-camera subject verified"
        },
        "voice": {
          "clusterId": "VOICE-02",
          "embeddingDim": 256,
          "model": "pyannote/wespeaker-voxceleb-resnet34-LM",
          "verifiedTurns": 3
        },
        "excerptId": "ex2",
        "locationLabel": "Mission Creek",
        "fieldNote": "42, traveled on foot for 30 days from Visalia, California to San Francisco."
      },
      "Rebecca Mallory": {
        "name": "Rebecca Mallory",
        "character": "REBECCA",
        "onCamera": true,
        "face": {
          "clusterId": "FACE-03",
          "embeddingDim": 512,
          "model": "facenet-pytorch/InceptionResnetV1-vggface2",
          "status": "On-camera subject verified"
        },
        "voice": {
          "clusterId": "VOICE-03",
          "embeddingDim": 256,
          "model": "pyannote/wespeaker-voxceleb-resnet34-LM",
          "verifiedTurns": 5
        },
        "excerptId": "ex3",
        "locationLabel": "Taylor Street, Tenderloin",
        "fieldNote": "Filmed on Taylor Street in the Tenderloin; previously lived up the street and in Los Angeles."
      },
      "Man Under Shelter (60)": {
        "name": "Man Under Shelter (60)",
        "character": "MAN UNDER SHELTER",
        "onCamera": true,
        "face": {
          "clusterId": "FACE-04",
          "embeddingDim": 512,
          "model": "facenet-pytorch/InceptionResnetV1-vggface2",
          "status": "On-camera subject verified"
        },
        "voice": {
          "clusterId": "VOICE-04",
          "embeddingDim": 256,
          "model": "pyannote/wespeaker-voxceleb-resnet34-LM",
          "verifiedTurns": 2
        },
        "excerptId": "ex4",
        "locationLabel": "Tenderloin Sidewalk Shelter",
        "fieldNote": "60-year-old resident speaking from inside a handmade sidewalk shelter in the Tenderloin."
      },
      "Zhan Petrov": {
        "name": "Zhan Petrov",
        "character": "FILMMAKER (O.S.)",
        "onCamera": false,
        "face": null,
        "voice": {
          "clusterId": "VOICE-05",
          "embeddingDim": 256,
          "model": "pyannote/wespeaker-voxceleb-resnet34-LM",
          "verifiedTurns": 9
        },
        "excerptId": "all",
        "locationLabel": "Behind Camera · Tenderloin & Mission Creek",
        "fieldNote": "Director interviewing on foot behind the handheld camera."
      },
      "Female Co-Interviewer": {
        "name": "Female Co-Interviewer",
        "character": "CO-INTERVIEWER (O.S.)",
        "onCamera": false,
        "face": null,
        "voice": {
          "clusterId": "VOICE-06",
          "embeddingDim": 256,
          "model": "pyannote/wespeaker-voxceleb-resnet34-LM",
          "verifiedTurns": 3
        },
        "excerptId": "ex3",
        "locationLabel": "Behind Camera · Taylor Street, Tenderloin",
        "fieldNote": "Co-interviewer speaking behind the camera on Taylor Street."
      }
    }
  },
  "locations": [
    {
      "id": "ex1",
      "chapterNum": "01",
      "tabLabel": "Nicholas (“Poodle”)",
      "excerptLabel": "Excerpt 1 · Muni Light-Rail Platform (00:00–01:05)",
      "locationLabel": "Muni Light-Rail Platform",
      "neighborhood": "Market / Tenderloin Corridor, SF",
      "coordsLabel": "37.7836° N, 122.4112° W",
      "slugline": "EXT. MUNI LIGHT-RAIL PLATFORM - NIGHT",
      "x": 255,
      "y": 168,
      "speaker": "Nicholas (“Poodle”)",
      "faceId": "FACE-01",
      "voiceId": "VOICE-01",
      "startSeconds": 0,
      "endSeconds": 65,
      "lineCount": 5
    },
    {
      "id": "ex2",
      "chapterNum": "06",
      "tabLabel": "Milo Parraz",
      "excerptLabel": "Excerpt 2 · Mission Creek (14:44–16:00)",
      "locationLabel": "Mission Creek",
      "neighborhood": "Mission Creek · Visalia, CA → SF",
      "coordsLabel": "37.7764° N, 122.3943° W",
      "slugline": "EXT. MISSION CREEK - NIGHT",
      "x": 438,
      "y": 226,
      "speaker": "Milo Parraz",
      "faceId": "FACE-02",
      "voiceId": "VOICE-02",
      "startSeconds": 884,
      "endSeconds": 960,
      "lineCount": 7
    },
    {
      "id": "ex3",
      "chapterNum": "08",
      "tabLabel": "Rebecca Mallory",
      "excerptLabel": "Excerpt 3 · Taylor Street, Tenderloin (18:50–20:18)",
      "locationLabel": "Taylor Street, Tenderloin",
      "neighborhood": "Tenderloin, San Francisco",
      "coordsLabel": "37.7848° N, 122.4116° W",
      "slugline": "EXT. TAYLOR STREET, TENDERLOIN - NIGHT",
      "x": 242,
      "y": 88,
      "speaker": "Rebecca Mallory",
      "faceId": "FACE-03",
      "voiceId": "VOICE-03",
      "startSeconds": 1130,
      "endSeconds": 1218,
      "lineCount": 10
    },
    {
      "id": "ex4",
      "chapterNum": "09",
      "tabLabel": "Man Under Shelter",
      "excerptLabel": "Excerpt 4 · Tenderloin Sidewalk Shelter (22:45–23:45)",
      "locationLabel": "Tenderloin Sidewalk Shelter",
      "neighborhood": "Eddy St / Tenderloin, SF",
      "coordsLabel": "37.7839° N, 122.4146° W",
      "slugline": "EXT. TENDERLOIN SIDEWALK SHELTER - NIGHT",
      "x": 132,
      "y": 136,
      "speaker": "Man Under Shelter (60)",
      "faceId": "FACE-04",
      "voiceId": "VOICE-04",
      "startSeconds": 1365,
      "endSeconds": 1425,
      "lineCount": 3
    }
  ],
  "sources": [
    {
      "id": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "title": "HOW I SEE — Street Interviews (Short Excerpts)",
      "shortLabel": "HOW I SEE · Street Interviews",
      "author": "Zhan Petrov · 220 Lab",
      "durationSeconds": 2503,
      "isExcerptOnly": true,
      "fullProductUrl": "https://howisee.homes/?utm_source=scriptlab&utm_medium=site&utm_campaign=howisee#interviews",
      "fullProductLabel": "Full uncut interviews (41:43) → howisee.homes",
      "thumbnailUrl": "assets/how-i-see-trailer-poster.jpg",
      "languageCode": "en",
      "isAutoCaptions": false,
      "lineCount": 25
    }
  ],
  "lines": [
    {
      "id": "SRC-871b72cc48",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 0,
      "speaker": "Nicholas (“Poodle”)",
      "speakerVerified": true,
      "faceId": "FACE-01",
      "voiceId": "VOICE-01",
      "onCamera": true,
      "text": "Hi, my name is Nicholas Michael Nelson. You can call me Poodle. And I can’t believe I don’t even have lipstick on for this. Go ahead with the interview questions. What do you want to know?",
      "wordCount": 36,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex1",
      "excerptLabel": "Excerpt 1 · Muni Light-Rail Platform (00:00–01:05)",
      "locationLabel": "Muni Light-Rail Platform",
      "excerptStart": 0,
      "excerptEnd": 65
    },
    {
      "id": "SRC-20ea57c92f",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 14,
      "speaker": "Zhan Petrov",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-05",
      "onCamera": false,
      "text": "How did you get on the street?",
      "wordCount": 7,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex1",
      "excerptLabel": "Excerpt 1 · Muni Light-Rail Platform (00:00–01:05)",
      "locationLabel": "Muni Light-Rail Platform",
      "excerptStart": 0,
      "excerptEnd": 65
    },
    {
      "id": "SRC-7f32479473",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 16,
      "speaker": "Nicholas (“Poodle”)",
      "speakerVerified": true,
      "faceId": "FACE-01",
      "voiceId": "VOICE-01",
      "onCamera": true,
      "text": "How did I get on the street? Well, typically, I wake up, leave my house, and I go down the stairs, and then I’m on the street. No—I was disinherited and disowned at 15 and kicked out of my rich, white, privileged mansion into the streets of freedom. And I get to be who I want, when I want, how I want. No one tells me jack shit.",
      "wordCount": 68,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex1",
      "excerptLabel": "Excerpt 1 · Muni Light-Rail Platform (00:00–01:05)",
      "locationLabel": "Muni Light-Rail Platform",
      "excerptStart": 0,
      "excerptEnd": 65
    },
    {
      "id": "SRC-052c65901c",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 45,
      "speaker": "Zhan Petrov",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-05",
      "onCamera": false,
      "text": "What is freedom for you?",
      "wordCount": 5,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex1",
      "excerptLabel": "Excerpt 1 · Muni Light-Rail Platform (00:00–01:05)",
      "locationLabel": "Muni Light-Rail Platform",
      "excerptStart": 0,
      "excerptEnd": 65
    },
    {
      "id": "SRC-038e2161bc",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 47,
      "speaker": "Nicholas (“Poodle”)",
      "speakerVerified": true,
      "faceId": "FACE-01",
      "voiceId": "VOICE-01",
      "onCamera": true,
      "text": "Freedom?",
      "wordCount": 1,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex1",
      "excerptLabel": "Excerpt 1 · Muni Light-Rail Platform (00:00–01:05)",
      "locationLabel": "Muni Light-Rail Platform",
      "excerptStart": 0,
      "excerptEnd": 65
    },
    {
      "id": "SRC-3216d694bb",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 886,
      "speaker": "Zhan Petrov",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-05",
      "onCamera": false,
      "text": "Okay—how old are you? How did you get on the street?",
      "wordCount": 11,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex2",
      "excerptLabel": "Excerpt 2 · Mission Creek (14:44–16:00)",
      "locationLabel": "Mission Creek",
      "excerptStart": 884,
      "excerptEnd": 960
    },
    {
      "id": "SRC-4d30caeeb8",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 888,
      "speaker": "Milo Parraz",
      "speakerVerified": true,
      "faceId": "FACE-02",
      "voiceId": "VOICE-02",
      "onCamera": true,
      "text": "42. I walked from Visalia, California. It took me 30 days. I left on the 11th of last month, and I just barely made it here tonight. It took me 30 days to walk here: I got one ride, two rides, three rides, and then I collected cans and bottles and camped on the creeksides and at the rivers, and bought a bus ticket and then a train ticket, and I’m here. I have a home—I just left.",
      "wordCount": 78,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex2",
      "excerptLabel": "Excerpt 2 · Mission Creek (14:44–16:00)",
      "locationLabel": "Mission Creek",
      "excerptStart": 884,
      "excerptEnd": 960
    },
    {
      "id": "SRC-fa09e4885e",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 938,
      "speaker": "Zhan Petrov",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-05",
      "onCamera": false,
      "text": "You’re just a traveler?",
      "wordCount": 4,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex2",
      "excerptLabel": "Excerpt 2 · Mission Creek (14:44–16:00)",
      "locationLabel": "Mission Creek",
      "excerptStart": 884,
      "excerptEnd": 960
    },
    {
      "id": "SRC-106bd1ec62",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 939,
      "speaker": "Milo Parraz",
      "speakerVerified": true,
      "faceId": "FACE-02",
      "voiceId": "VOICE-02",
      "onCamera": true,
      "text": "I’m just traveling on foot.",
      "wordCount": 5,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex2",
      "excerptLabel": "Excerpt 2 · Mission Creek (14:44–16:00)",
      "locationLabel": "Mission Creek",
      "excerptStart": 884,
      "excerptEnd": 960
    },
    {
      "id": "SRC-e3d0e5370b",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 942,
      "speaker": "Zhan Petrov",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-05",
      "onCamera": false,
      "text": "Like a nomad?",
      "wordCount": 3,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex2",
      "excerptLabel": "Excerpt 2 · Mission Creek (14:44–16:00)",
      "locationLabel": "Mission Creek",
      "excerptStart": 884,
      "excerptEnd": 960
    },
    {
      "id": "SRC-9d83aa0a13",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 943,
      "speaker": "Milo Parraz",
      "speakerVerified": true,
      "faceId": "FACE-02",
      "voiceId": "VOICE-02",
      "onCamera": true,
      "text": "Yes, like the old days, I guess.",
      "wordCount": 7,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex2",
      "excerptLabel": "Excerpt 2 · Mission Creek (14:44–16:00)",
      "locationLabel": "Mission Creek",
      "excerptStart": 884,
      "excerptEnd": 960
    },
    {
      "id": "SRC-57bd652357",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 948,
      "speaker": "Zhan Petrov",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-05",
      "onCamera": false,
      "text": "Okay. And can you say what is your name and how we can find you?",
      "wordCount": 15,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex2",
      "excerptLabel": "Excerpt 2 · Mission Creek (14:44–16:00)",
      "locationLabel": "Mission Creek",
      "excerptStart": 884,
      "excerptEnd": 960
    },
    {
      "id": "SRC-abc7fcba79",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1131,
      "speaker": "Female Co-Interviewer",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-06",
      "onCamera": false,
      "text": "So say, please, what’s your name?",
      "wordCount": 6,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex3",
      "excerptLabel": "Excerpt 3 · Taylor Street, Tenderloin (18:50–20:18)",
      "locationLabel": "Taylor Street, Tenderloin",
      "excerptStart": 1130,
      "excerptEnd": 1218
    },
    {
      "id": "SRC-ccf372991b",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1133,
      "speaker": "Rebecca Mallory",
      "speakerVerified": true,
      "faceId": "FACE-03",
      "voiceId": "VOICE-03",
      "onCamera": true,
      "text": "Rebecca Mallory [middle names] Rock.",
      "wordCount": 5,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex3",
      "excerptLabel": "Excerpt 3 · Taylor Street, Tenderloin (18:50–20:18)",
      "locationLabel": "Taylor Street, Tenderloin",
      "excerptStart": 1130,
      "excerptEnd": 1218
    },
    {
      "id": "SRC-0a5162ef20",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1138,
      "speaker": "Female Co-Interviewer",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-06",
      "onCamera": false,
      "text": "And how long have you been here? And before, where did you live?",
      "wordCount": 13,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex3",
      "excerptLabel": "Excerpt 3 · Taylor Street, Tenderloin (18:50–20:18)",
      "locationLabel": "Taylor Street, Tenderloin",
      "excerptStart": 1130,
      "excerptEnd": 1218
    },
    {
      "id": "SRC-08d70fae3e",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1142,
      "speaker": "Rebecca Mallory",
      "speakerVerified": true,
      "faceId": "FACE-03",
      "voiceId": "VOICE-03",
      "onCamera": true,
      "text": "I lived up the street a few years ago—maybe 10, 15 years, maybe a little less. [Before that] Los Angeles.",
      "wordCount": 20,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex3",
      "excerptLabel": "Excerpt 3 · Taylor Street, Tenderloin (18:50–20:18)",
      "locationLabel": "Taylor Street, Tenderloin",
      "excerptStart": 1130,
      "excerptEnd": 1218
    },
    {
      "id": "SRC-56b64a3add",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1159,
      "speaker": "Female Co-Interviewer",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-06",
      "onCamera": false,
      "text": "And do you live together with this man?",
      "wordCount": 8,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex3",
      "excerptLabel": "Excerpt 3 · Taylor Street, Tenderloin (18:50–20:18)",
      "locationLabel": "Taylor Street, Tenderloin",
      "excerptStart": 1130,
      "excerptEnd": 1218
    },
    {
      "id": "SRC-4c0b469bfe",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1161,
      "speaker": "Rebecca Mallory",
      "speakerVerified": true,
      "faceId": "FACE-03",
      "voiceId": "VOICE-03",
      "onCamera": true,
      "text": "No, I just kind of move around all over. I used to live right up there.",
      "wordCount": 16,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex3",
      "excerptLabel": "Excerpt 3 · Taylor Street, Tenderloin (18:50–20:18)",
      "locationLabel": "Taylor Street, Tenderloin",
      "excerptStart": 1130,
      "excerptEnd": 1218
    },
    {
      "id": "SRC-0884645810",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1176,
      "speaker": "Zhan Petrov",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-05",
      "onCamera": false,
      "text": "Do you take drugs? Are you getting any help from the government?",
      "wordCount": 12,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex3",
      "excerptLabel": "Excerpt 3 · Taylor Street, Tenderloin (18:50–20:18)",
      "locationLabel": "Taylor Street, Tenderloin",
      "excerptStart": 1130,
      "excerptEnd": 1218
    },
    {
      "id": "SRC-dae03d06d6",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1181,
      "speaker": "Rebecca Mallory",
      "speakerVerified": true,
      "faceId": "FACE-03",
      "voiceId": "VOICE-03",
      "onCamera": true,
      "text": "Yeah. A little bit—I get food stamps, about $300 a month, not cash.",
      "wordCount": 13,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex3",
      "excerptLabel": "Excerpt 3 · Taylor Street, Tenderloin (18:50–20:18)",
      "locationLabel": "Taylor Street, Tenderloin",
      "excerptStart": 1130,
      "excerptEnd": 1218
    },
    {
      "id": "SRC-4ebf9a6345",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1190,
      "speaker": "Zhan Petrov",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-05",
      "onCamera": false,
      "text": "Did you finish school? Did you get enrolled in college?",
      "wordCount": 10,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex3",
      "excerptLabel": "Excerpt 3 · Taylor Street, Tenderloin (18:50–20:18)",
      "locationLabel": "Taylor Street, Tenderloin",
      "excerptStart": 1130,
      "excerptEnd": 1218
    },
    {
      "id": "SRC-2b4dcc8dca",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1192,
      "speaker": "Rebecca Mallory",
      "speakerVerified": true,
      "faceId": "FACE-03",
      "voiceId": "VOICE-03",
      "onCamera": true,
      "text": "Yeah, I graduated two years early. I went to college a little bit, not a lot.",
      "wordCount": 16,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex3",
      "excerptLabel": "Excerpt 3 · Taylor Street, Tenderloin (18:50–20:18)",
      "locationLabel": "Taylor Street, Tenderloin",
      "excerptStart": 1130,
      "excerptEnd": 1218
    },
    {
      "id": "SRC-fbdef35149",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1367,
      "speaker": "Man Under Shelter (60)",
      "speakerVerified": true,
      "faceId": "FACE-04",
      "voiceId": "VOICE-04",
      "onCamera": true,
      "text": "This is the most stressful, the most frustrating part about being outside and trying to give an interview to you guys: the wind—my worst enemy—and the rain—my worst nightmare. A hole in your structure, it’s traumatic, it’s like a tsunami. This right here is just handmade, you know.",
      "wordCount": 48,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex4",
      "excerptLabel": "Excerpt 4 · Tenderloin Sidewalk Shelter (22:45–23:45)",
      "locationLabel": "Tenderloin Sidewalk Shelter",
      "excerptStart": 1365,
      "excerptEnd": 1425
    },
    {
      "id": "SRC-2595f912fe",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1391,
      "speaker": "Zhan Petrov",
      "speakerVerified": true,
      "faceId": null,
      "voiceId": "VOICE-05",
      "onCamera": false,
      "text": "How old are you?",
      "wordCount": 4,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex4",
      "excerptLabel": "Excerpt 4 · Tenderloin Sidewalk Shelter (22:45–23:45)",
      "locationLabel": "Tenderloin Sidewalk Shelter",
      "excerptStart": 1365,
      "excerptEnd": 1425
    },
    {
      "id": "SRC-c315334add",
      "workshopId": "yt_QgwRsArIVKI",
      "youtubeId": "QgwRsArIVKI",
      "seconds": 1392,
      "speaker": "Man Under Shelter (60)",
      "speakerVerified": true,
      "faceId": "FACE-04",
      "voiceId": "VOICE-04",
      "onCamera": true,
      "text": "About 60 years old, ashamed to say. I’ve been on drugs 40-something years: cocaine powder at 16, 17, 18 years old; 19 to now, crack cocaine only, a little speed. Got sick off fentanyl accidentally—stayed in the hospital a couple days, took me about a week and a half to get well. My stomach was tore up, it felt like hell, liquid diet for a week and a half, and that weekend whoever was on duty that shift robbed me and took my money.",
      "wordCount": 84,
      "themes": [
        "identity",
        "truth"
      ],
      "excerptId": "ex4",
      "excerptLabel": "Excerpt 4 · Tenderloin Sidewalk Shelter (22:45–23:45)",
      "locationLabel": "Tenderloin Sidewalk Shelter",
      "excerptStart": 1365,
      "excerptEnd": 1425
    }
  ]
};
