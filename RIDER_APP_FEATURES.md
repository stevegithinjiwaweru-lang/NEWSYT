# NEWSYT Rider App Features

## 🚴 Rider Delivery Screen

### Core Features

#### 1. **Live Map Tracking**
- Real-time GPS tracking with continuous location updates
- Interactive map showing:
  - 🟢 Rider's current location (green marker)
  - 📦 Delivery location (red marker)
  - Route line connecting pickup to delivery
  - 100m delivery radius circle
- Auto-zoom and fit to screen
- Location accuracy indicator

#### 2. **Dispatch Management**
- Display active dispatch with order reference
- Show current dispatch status with color-coded badges
- Automatic status lifecycle tracking:
  - ASSIGNED → PICKED_UP → EN_ROUTE → ARRIVED → DELIVERED
  - Error branches: FAILED (with reason)

#### 3. **Navigation & ETA**
- Real-time distance calculation (Haversine formula)
- ETA calculation based on ~50 km/h average speed
- Continuous updates as rider moves
- Shows distance in kilometers
- Shows ETA in minutes

#### 4. **Action Buttons**
- **Call Customer**: Quick contact via phone
- **Picked Up Package**: Mark package collected
- **Started Delivery**: Begin delivery journey
- **Arrived at Location**: Notify arrival
- **Complete Delivery**: Finish delivery with confirmation
  - Dialog asks if customer is satisfied
  - Option to report issue/failure reason
  - Success path: Mark as DELIVERED
  - Failure path: Record reason and mark FAILED

#### 5. **Payment on Delivery (COD)**
- Display if order requires cash collection
- Show amount in KES
- Rider confirmation during delivery
- Payment method recorded (e.g., "mpesa", "cash")
- Payment reference stored

#### 6. **Background Location Tracking**
- Continuous location updates sent to backend every 5 seconds or 10 meters
- Runs in background during delivery
- Survives app state changes
- Battery optimized with appropriate intervals

### Technical Implementation

```typescript
// Location Tracking
- Uses `expo-location` for GPS
- Watches position with 5-second intervals
- Auto-updates backend via `/riders/:id/location` API
- Calculates distance using Haversine formula
- Updates map markers in real-time

// Distance Calculation
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  // Haversine formula implementation
  return distance in km
}

// Status Lifecycle
ASSOGNED -> action:pickup -> PICKED_UP
         -> action:start -> EN_ROUTE
                         -> action:arrive -> ARRIVED
                                         -> action:complete -> DELIVERED or FAILED
```

## 👤 Rider Profile Screen

### Core Features

#### 1. **Profile Information**
- Rider avatar/icon
- Name and phone number
- Vehicle details:
  - Vehicle type (motorcycle, van, bicycle)
  - License plate
- Online/offline status toggle
  - Live status indicator (🟢 Online / 🔴 Offline)
  - Syncs with backend (AVAILABLE/OFFLINE)

#### 2. **Performance Analytics**
- **Total Deliveries**: Lifetime delivery count
- **Completed Today**: Today's delivery count
- **Earnings**: Total earnings in KES
- **Rating**: Average customer rating (0-5)
- Visual stat cards with icons and labels

#### 3. **Quick Actions**
- **My Documents**: Upload/manage:
  - Driver's license
  - National ID
  - Insurance documents
  - Vehicle registration

- **Bank Details**: Manage payment method
  - Account number
  - Bank name
  - Account holder name
  - Update payout preferences

- **Promo Code**: Apply:
  - Referral bonuses
  - Promotional codes
  - Special earnings boosters

#### 4. **Settings**
- **Push Notifications**: Enable/disable delivery alerts
- **Location Sharing**: Control real-time tracking
- **Contact Support**: In-app support chat
- **About App**: Version info and credits

#### 5. **Session Management**
- Online/offline toggle (main header)
- Logout button (bottom)
- Auto-logout on app close
- Session persistence with token

### UI/UX Design

#### Color Scheme
- Primary: #2196F3 (Blue)
- Success: #4CAF50 (Green)
- Warning: #FF9800 (Orange)
- Danger: #FF6B6B (Red)
- Info: #00BCD4 (Cyan)
- Neutral: #999, #e0e0e0

#### Icon Sets
- **Ionicons**: Navigation, status, core actions
- **MaterialCommunityIcons**: Delivery, package, vehicle
- **FontAwesome5**: Money, support, analytics

#### Layout Patterns
- Scrollable sections with headers
- Card-based information display
- Stat grids (2 columns on mobile)
- Toggle switches for settings
- Action buttons with icons and labels

### API Integration

#### Required Endpoints
```
GET  /api/riders/:riderId
PATCH /api/riders/:riderId              (status update)
POST /api/riders/:riderId/location      (location tracking)
GET  /api/dispatches                    (active dispatch)
PATCH /api/orders/:orderId/status       (status update)
```

#### WebSocket Events (Socket.io)
```
connect -> socket.emit('join', { role: 'RIDER', riderId })
receive 'dispatch:new' -> New delivery assigned
receive 'dispatch:cancel' -> Delivery cancelled
receive 'order:status:update' -> Order status change
```

### Notifications

#### Push Notifications
- New delivery assignment
- Delivery cancellation
- Status update from dispatcher
- Customer message/call
- Earning bonus/incentive

#### In-App Notifications
- Toast messages for actions
- Status confirmation dialogs
- Error alerts with recovery options

### Performance Optimization

- Lazy loading of rider stats
- Efficient location tracking (5s/10m intervals)
- Memoized components to prevent re-renders
- Query caching with 30-second refetch interval
- Background task optimization

### Security

- Bearer token authentication
- Location data encrypted in transit
- Automatic logout on token expiry
- Device-level location permissions
- Secure storage of credentials

### Future Enhancements

- [ ] Multi-language support
- [ ] Offline mode (cache recent orders)
- [ ] Video proof of delivery
- [ ] Customer signature capture
- [ ] Return journey tracking
- [ ] Fuel expense tracking
- [ ] Performance leaderboard
- [ ] Customer ratings display
- [ ] Task scheduling/batching
- [ ] In-app chat with support
