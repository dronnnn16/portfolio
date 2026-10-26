// Testimonials section is hidden while this array is empty.
// Add only real quotes from real clients. Photos go in /public/testimonials/.
//
// Example shape:
// {
//   quote: "…",
//   name: "Full Name",
//   role: "Founder, Company",
//   photo: "/testimonials/full-name.jpg",
// },
export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  photo?: string;
};

export const testimonialsIntro = {
  label: "Testimonials",
  title: "What clients say",
};

export const testimonials: Testimonial[] = [];
