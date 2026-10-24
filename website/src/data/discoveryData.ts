/**
 * Curated Music Discovery Catalog
 * Apple Music / BitChord-style high-fidelity track and album discovery data.
 */

export interface TrackItem {
  title: string;
  artist: string;
  cover: string;
  explicit?: boolean;
}

export interface AlbumItem {
  title: string;
  artist: string;
  cover: string;
  explicit?: boolean;
}

export const BEST_NEW_GROUPS: TrackItem[][] = [
  [
    {
      "title": "Weekend In Texas",
      "artist": "Kacey Musgraves",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/06/70/5a/06705a59-c9ec-ee4c-0b4f-d29108151b36/26UM1IM30839.rgb.jpg/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "Airbender",
      "artist": "Anderson .Paak, Cordae",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/2b/81/23/2b8123af-f191-32ea-e856-fc4ad33599b6/199316732108_cover.jpg/600x600bb.jpg",
      "explicit": true
    },
    {
      "title": "Not Falling Out (feat. Carly Pearce)",
      "artist": "Max McNown",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/88/bd/67/88bd67d6-e36b-ebb8-530c-cf0ba12177c6/850077888540.jpg/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "Who You Callin&#x27; Crazy",
      "artist": "The Rolling Stones",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/84/27/75/84277582-16e7-787e-7280-100bb00ddb27/26UM1IM29303.rgb.jpg/600x600bb.jpg",
      "explicit": false
    }
  ],
  [
    {
      "title": "Bodies On The Floor",
      "artist": "John Legend, Clipse",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/df/1b/c6/df1bc6c4-c2a7-66e9-afc0-46c9ae49516a/26UM1IM12676.rgb.jpg/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "Nadie Te Extraña",
      "artist": "Xavi",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1d/43/3c/1d433ca7-d9d5-0189-46bd-7baf2accd203/823375539636_Cover.jpg/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "custom MADE.",
      "artist": "YFN Lucci, Tink",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ff/a0/73/ffa073e3-0ba3-3dd4-77df-1d140b492867/075679551603.jpg/600x600bb.jpg",
      "explicit": true
    },
    {
      "title": "Smartest Person in the Room",
      "artist": "Lennon Stella",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/57/50/98/575098af-356c-1e63-9135-db7444f5f1c9/196874554234.jpg/600x600bb.jpg",
      "explicit": true
    }
  ],
  [
    {
      "title": "Peace &amp; Patience",
      "artist": "Jazzy",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ac/30/9a/ac309a81-d58b-6f43-32db-f7a2edf68be6/26UMGIM68307.rgb.jpg/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "Random Violence",
      "artist": "Hot Chip",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bf/40/28/bf402861-3e27-9c7e-3400-e89647f4ec6c/887828053469.png/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "love or something like it (feat. Lucky Daye)",
      "artist": "Halle",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/40/cc/18/40cc1809-3d2c-0cf0-d6d2-20031c080cbc/196874617663.jpg/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "Drip",
      "artist": "ATEEZ",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/c3/c5/84/c3c5844d-602e-e7b7-1efa-2b6bdddc9141/196874851814.jpg/600x600bb.jpg",
      "explicit": false
    }
  ],
  [
    {
      "title": "Tom and Jerry",
      "artist": "John Mayer",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/6c/ac/34/6cac34de-b0cd-d637-fcd7-c6b297dde7b3/26UM1IM34215.rgb.jpg/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "Back To The Start",
      "artist": "BUNT.",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/73/90/1a/73901a91-e210-aed9-3f51-aefdd2042fe9/196874706848.jpg/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "SO MUCH, SO MUCH",
      "artist": "Laila!",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/47/0d/15/470d15e3-071f-0157-0175-fc97053ca6af/093624821212.jpg/600x600bb.jpg",
      "explicit": true
    },
    {
      "title": "Birthday Wish",
      "artist": "NMIXX",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/f1/ab/48f1abb9-adb8-1880-f829-1657fff3e7f3/8809928956848_Cover.jpg/600x600bb.jpg",
      "explicit": false
    }
  ],
  [
    {
      "title": "California",
      "artist": "Michael Kiwanuka",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/8a/87/68/8a8768b3-d686-dac5-25da-fca1ea373114/25UMGIM95889.rgb.jpg/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "Jester in the Bowl",
      "artist": "Mon Rovîa",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/26/bf/28/26bf28ca-ce81-b7fb-c212-a9ec9ff61bdc/067003047883.png/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "Old Song",
      "artist": "King Princess",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/2f/b9/bc/2fb9bc60-695f-5bb3-aeeb-339919bc06e6/0720841363798_Cover.jpg/600x600bb.jpg",
      "explicit": false
    },
    {
      "title": "ocean park",
      "artist": "Rubí",
      "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/eb/1a/7b/eb1a7bba-c1bc-7962-78fd-ef9ae3499469/885288628319.jpg/600x600bb.jpg",
      "explicit": true
    }
  ]
];

export const NEW_THIS_WEEK: AlbumItem[] = [
  {
    "title": "PRESS PLAY",
    "artist": "LISA",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1d/de/67/1dde6726-f217-b447-46cd-94d5f9621797/196874712696.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Watch Dis",
    "artist": "Yung Miami",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d3/2d/71/d32d7140-6086-8a5f-a8df-2dfb5dfabf98/26UM1IM06145.rgb.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Muse",
    "artist": "John Legend",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/df/1b/c6/df1bc6c4-c2a7-66e9-afc0-46c9ae49516a/26UM1IM12676.rgb.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Heavy Is The Crown",
    "artist": "Anderson .Paak, Cordae",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/2b/81/23/2b8123af-f191-32ea-e856-fc4ad33599b6/199316732108_cover.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Race Day Rev-Up: Austin (DJ Mix)",
    "artist": "Diplo",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/90/26/3e/90263ec9-4573-50bc-fe6a-601a3fefdc52/8d44ef9f-7f33-4a99-9ee4-2dd45b826aa6.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Luh Leakyz Vol. 1",
    "artist": "Yeat, Lyfestyle Corporation",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/76/a8/aa/76a8aa34-3e82-73e5-fdd7-1844f35d31b6/26UM1IM37849.rgb.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Damascus Road",
    "artist": "Josiah Queen",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/29/d1/e9/29d1e939-5e58-6da1-0727-b40c0a7be5cf/26SYMIM33680.rgb.jpg/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "Sleeping Lion",
    "artist": "Lennon Stella",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/57/50/98/575098af-356c-1e63-9135-db7444f5f1c9/196874554234.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "The Black Parade (20th Anniversary Deluxe Edition)",
    "artist": "My Chemical Romance",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/68/aa/59/68aa5901-fc7c-a84c-8743-9a63a8151c53/093624816263.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Apple Music Sessions",
    "artist": "Dylan Gossett",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a5/8a/23/a58a2336-24e5-c69b-33db-35e17a2f8768/26UM1IM35537.rgb.jpg/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "BLUE - EP",
    "artist": "girl in red",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/67/aa/47/67aa47f5-d394-8269-9571-5b464a367481/196874792438.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "FUDGE",
    "artist": "Michael Kiwanuka",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/8a/87/68/8a8768b3-d686-dac5-25da-fca1ea373114/25UMGIM95889.rgb.jpg/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "Holiday Things - EP",
    "artist": "Hilary Duff",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1f/8f/28/1f8f28b9-0b13-74e2-cd73-268dad4e2e2a/075679552549.jpg/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "From the Dark",
    "artist": "Tony Iommi, Jorn",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b1/58/8e/b1588ebe-d488-87c9-73a1-9eb66adeb944/4099964278507.jpg/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "Ruff &amp; Tuff (From &quot;The Drop: A Snowfall Saga&quot;) - EP",
    "artist": "The Drop - Cast",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/bd/90/1e/bd901ebc-f35e-ceed-e31b-d2620498dbd1/26UM1IM28118.rgb.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "2manydjs at Trash: 30.08.04 (DJ Mix)",
    "artist": "2manydjs",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/64/07/27/640727f8-8595-7cb0-aa0b-c351ec0c59f0/6d18a224-088f-467c-a47c-2bcd20ca02c7.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "love?... or something like it (Deluxe)",
    "artist": "Halle",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/40/cc/18/40cc1809-3d2c-0cf0-d6d2-20031c080cbc/196874617663.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Cucuy",
    "artist": "That Mexican OT",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/93/2a/88/932a8887-b6ad-609f-a698-be431e2626b1/26UM1IM16949.rgb.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Levi Did It",
    "artist": "BUNT.",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/73/90/1a/73901a91-e210-aed9-3f51-aefdd2042fe9/196874706848.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "The Music of EPCOT",
    "artist": "Various Artists",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/35/af/fa/35affa7d-bbbf-2dbb-64db-a5baa895cc6f/26UM1IM35533.rgb.jpg/500x500bb.jpg",
    "explicit": false
  }
];

export const RECENT_RELEASES: AlbumItem[] = [
  {
    "title": "Against All Odds",
    "artist": "Gucci Mane",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/36/ac/32/36ac32fd-98d6-8ca1-0d17-038e439a4dde/075679559159.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Dopamine Chamber",
    "artist": "Fontaines D.C.",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/24/10/8c/24108c9c-845b-40f3-6175-9effb95e1d5c/191404167373.png/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "No Bad Memories",
    "artist": "The Avalanches",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ba/f2/3c/baf23ce1-3ebc-f950-024e-52d9b38e62e1/26UMGIM98135.rgb.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Thread - EP",
    "artist": "Emily Ann Roberts",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/46/02/77/460277d5-052b-e4f1-98bf-837b37013caf/196874695463.jpg/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "The Girl Of Your Dreams",
    "artist": "Ashe",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1b/86/c9/1b86c988-03b8-ca21-10a5-0963d09f5bcf/075679561893.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "I think I spoke too soon",
    "artist": "Rachel Chinouriri",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/be/f0/af/bef0afae-6902-b97b-084a-1222eff76df7/1200214614201.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "While The Flood Rages",
    "artist": "Max Richter",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a7/9a/da/a79adad8-5a6f-d0e4-9a5f-cb9743c8f548/26UMGIM25785.rgb.jpg/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "It Was My First Time - EP",
    "artist": "Sydney Rose",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/53/24/b1/5324b1de-6a2e-f2d0-e05c-7a4c67df3951/26UM1IM16900.rgb.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Jesus &amp; Whiskey",
    "artist": "K. Michelle",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/54/d2/9d/54d29d73-6dbe-c1e5-6a05-eecac7f3bbba/4099964283327.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "EG.0",
    "artist": "Ellie Goulding",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ab/78/9c/ab789c43-1f4d-6b37-26c3-f9d360a34cc6/26UM1IM19718.rgb.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Instinct",
    "artist": "Angèle",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bc/39/8c/bc398c3b-f73a-0d32-a375-58b9778af5f3/196874659786.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Autosmile",
    "artist": "@",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/96/bf/09/96bf09cb-e1e0-32c0-44bc-ab2e443dcb4d/191400091078.png/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "Back to Pennsylvania",
    "artist": "Anna Shoemaker",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cf/47/41/cf474150-619f-fe83-8aca-a740245fb903/128775.jpg/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "mosca",
    "artist": "Nsqk",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/98/ae/11/98ae1157-1776-fa1e-4bda-a1358383d86e/823375457275_Cover.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Answers",
    "artist": "Bibio, Dorian Concept",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f5/c7/cf/f5c7cfa1-1163-501c-396c-11ddccadfa85/5056818807497.png/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "Flavorz Pack",
    "artist": "Dei V",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/2f/07/88/2f078833-2f0e-9066-1414-074c6bd6a7d0/885288786965.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "ALOUD!",
    "artist": "Lucky Daye",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/34/1e/a5/341ea54e-9d83-75b3-e4db-861facb919d4/093624820109.jpg/500x500bb.jpg",
    "explicit": true
  },
  {
    "title": "Tenzing (Soundtrack from the Apple Original Film)",
    "artist": "Rebekka Karijord",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f3/b2/84/f3b28413-f458-b9e4-908a-2f171491334b/196874742181.jpg/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "Today at Apple: London (DJ Mix)",
    "artist": "Jodie Harsh",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/2c/1c/3d/2c1c3d03-295f-f3a2-d532-a025e14b76ae/ded1544c-0126-43cd-8742-685143e217f7.png/500x500bb.jpg",
    "explicit": false
  },
  {
    "title": "STAR (Deluxe Version)",
    "artist": "Tombochio",
    "cover": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/58/d5/67/58d56700-37c7-858c-142a-0175d882c30f/196874811610.jpg/500x500bb.jpg",
    "explicit": true
  }
];
