/**
 * Pre-built pass template configurations for common use cases
 */

module.exports = {
  /**
   * Welcome Offer - Special discount for new customers
   */
  welcomeOffer: {
    name: "Benvenuto",
    pass_type: "coupon",
    fields: [
      {
        key: "offer",
        label: "OFFERTA",
        value: "-20%",
        type: "primary"
      },
      {
        key: "description",
        label: "Descrizione",
        value: "Sul tuo primo acquisto",
        type: "secondary"
      },
      {
        key: "expiry",
        label: "Scadenza",
        value: "",
        type: "auxiliary",
        dateStyle: "PKDateStyleShort"
      }
    ],
    style: {
      backgroundColor: "#0D0B1A",
      foregroundColor: "#FFFFFF",
      labelColor: "#FFFFFF"
    }
  },

  /**
   * Flash Promo - Limited-time promotion
   */
  flashPromo: {
    name: "Promo Flash",
    pass_type: "coupon",
    fields: [
      {
        key: "title",
        label: "PROMOZIONE",
        value: "SCONTO LAMPO",
        type: "primary"
      },
      {
        key: "discount",
        label: "Valore",
        value: "-30%",
        type: "header"
      },
      {
        key: "validity",
        label: "Valida fino a",
        value: "",
        type: "secondary",
        dateStyle: "PKDateStyleShort"
      },
      {
        key: "conditions",
        label: "Limitato a",
        value: "Acquisti superiori a €50",
        type: "auxiliary"
      }
    ],
    style: {
      backgroundColor: "#FF6B35",
      foregroundColor: "#FFFFFF",
      labelColor: "#FFD700"
    }
  },

  /**
   * Event Ticket - For event access
   */
  eventTicket: {
    name: "Biglietto Evento",
    pass_type: "eventTicket",
    fields: [
      {
        key: "event",
        label: "EVENTO",
        value: "Conference 2026",
        type: "primary"
      },
      {
        key: "date",
        label: "Data",
        value: "",
        type: "secondary",
        dateStyle: "PKDateStyleMedium"
      },
      {
        key: "seat",
        label: "Posto",
        value: "A42",
        type: "auxiliary"
      },
      {
        key: "holder",
        label: "Intestato a",
        value: "",
        type: "secondary"
      },
      {
        key: "terms",
        label: "Note",
        value: "Non trasferibile. Valido solo con documento d'identità.",
        type: "back"
      }
    ],
    style: {
      backgroundColor: "#2C3E50",
      foregroundColor: "#FFFFFF",
      labelColor: "#3498DB"
    }
  },

  /**
   * Member Card - Store membership/loyalty card
   */
  memberCard: {
    name: "Carta Membro",
    pass_type: "storeCard",
    fields: [
      {
        key: "name",
        label: "MEMBRO VIP",
        value: "",
        type: "primary"
      },
      {
        key: "membership",
        label: "Livello",
        value: "GOLD",
        type: "header"
      },
      {
        key: "points",
        label: "Punti Fedeltà",
        value: "0",
        type: "secondary"
      },
      {
        key: "memberid",
        label: "ID Membro",
        value: "",
        type: "auxiliary"
      },
      {
        key: "benefits",
        label: "Vantaggi",
        value: "Sconto 15% su tutti gli acquisti + accesso anticipato alle vendite",
        type: "back"
      }
    ],
    style: {
      backgroundColor: "#1C1C1C",
      foregroundColor: "#FFFFFF",
      labelColor: "#FFD700"
    }
  },

  /**
   * Loyalty Card - Generic loyalty program
   */
  loyaltyCard: {
    name: "Tessera Fedeltà",
    pass_type: "storeCard",
    fields: [
      {
        key: "program",
        label: "PROGRAMMA",
        value: "FEDELTÀ",
        type: "primary"
      },
      {
        key: "tier",
        label: "Categoria",
        value: "Fedele",
        type: "header"
      },
      {
        key: "balance",
        label: "Crediti",
        value: "250",
        type: "secondary"
      },
      {
        key: "nextbenefit",
        label: "Prossimo Livello",
        value: "500 punti",
        type: "auxiliary"
      },
      {
        key: "info",
        label: "Informazioni",
        value: "Accumula 1 punto per ogni euro speso. Riscatta i tuoi punti per premi esclusivi.",
        type: "back"
      }
    ],
    style: {
      backgroundColor: "#0D0B1A",
      foregroundColor: "#FFFFFF",
      labelColor: "#FFFFFF"
    }
  },

  /**
   * Boarding Pass - For transit/travel
   */
  boardingPass: {
    name: "Carta d'Imbarco",
    pass_type: "boardingPass",
    fields: [
      {
        key: "route",
        label: "ROTTA",
        value: "MIL → ROM",
        type: "primary"
      },
      {
        key: "departure",
        label: "Partenza",
        value: "",
        type: "header",
        dateStyle: "PKDateStyleShort"
      },
      {
        key: "gate",
        label: "Gate",
        value: "B12",
        type: "secondary"
      },
      {
        key: "seat",
        label: "Posto",
        value: "12A",
        type: "auxiliary"
      },
      {
        key: "passenger",
        label: "Passeggero",
        value: "",
        type: "secondary"
      },
      {
        key: "notes",
        label: "Note",
        value: "Arrivo consigliato 2 ore prima della partenza",
        type: "back"
      }
    ],
    style: {
      backgroundColor: "#004B87",
      foregroundColor: "#FFFFFF",
      labelColor: "#FFC72C"
    }
  },

  /**
   * Generic Pass - Flexible multipurpose pass
   */
  generic: {
    name: "Pass Generico",
    pass_type: "generic",
    fields: [
      {
        key: "title",
        label: "TITOLO",
        value: "Benvenuto",
        type: "primary"
      },
      {
        key: "subtitle",
        label: "Sottotitolo",
        value: "",
        type: "secondary"
      },
      {
        key: "content",
        label: "Contenuto",
        value: "",
        type: "auxiliary"
      },
      {
        key: "details",
        label: "Dettagli",
        value: "",
        type: "back"
      }
    ],
    style: {
      backgroundColor: "#0D0B1A",
      foregroundColor: "#FFFFFF",
      labelColor: "#FFFFFF"
    }
  }
};
