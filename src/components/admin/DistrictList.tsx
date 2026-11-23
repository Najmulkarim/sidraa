/**
 * The 64 districts of Bangladesh as typing suggestions: an input with
 * list={DISTRICT_LIST_ID} offers the full name after a few letters.
 * Old spellings couriers still use are listed too. Staff can still type
 * anything else.
 */
export const DISTRICT_LIST_ID = 'bd-districts';

export const DISTRICTS = [
  'Bagerhat', 'Bandarban', 'Barguna', 'Barishal', 'Bhola', 'Bogura', 'Brahmanbaria', 'Chandpur', 'Chapai Nawabganj',
  'Chattogram', 'Chuadanga', "Cox's Bazar", 'Cumilla', 'Dhaka', 'Dinajpur', 'Faridpur', 'Feni', 'Gaibandha', 'Gazipur',
  'Gopalganj', 'Habiganj', 'Jamalpur', 'Jashore', 'Jhalokathi', 'Jhenaidah', 'Joypurhat', 'Khagrachhari', 'Khulna',
  'Kishoreganj', 'Kurigram', 'Kushtia', 'Lakshmipur', 'Lalmonirhat', 'Madaripur', 'Magura', 'Manikganj', 'Meherpur',
  'Moulvibazar', 'Munshiganj', 'Mymensingh', 'Naogaon', 'Narail', 'Narayanganj', 'Narsingdi', 'Natore', 'Netrokona',
  'Nilphamari', 'Noakhali', 'Pabna', 'Panchagarh', 'Patuakhali', 'Pirojpur', 'Rajbari', 'Rajshahi', 'Rangamati',
  'Rangpur', 'Satkhira', 'Shariatpur', 'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet', 'Tangail', 'Thakurgaon',
  // Old spellings
  'Barisal', 'Bogra', 'Chittagong', 'Comilla', 'Jessore',
];

export function DistrictList() {
  return (
    <datalist id={DISTRICT_LIST_ID}>
      {DISTRICTS.map((d) => <option key={d} value={d} />)}
    </datalist>
  );
}
